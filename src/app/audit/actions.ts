"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Db } from "@/db";
import { leads, users } from "@/db/schema";
import { signIn } from "@/lib/auth";
import { loadEnv } from "@/lib/env";
import { isSafeHttpUrl } from "@/lib/url";
import { accountErrorMessage, createAccountFromAudit } from "@/services/account-invites";
import { isUuid } from "@/services/audit-progress";
import { auditRequestSchema, sendAuditRequest, withScheme } from "@/services/audit-request";
import { attachContact, markNotPrepared, shouldPrepareLead, startLead } from "@/services/leads";
import { sendProspectReportFor } from "@/services/prospect-audit-email";
import { sendReportOnce } from "@/services/prospect-setup";
import { startProspectSetup } from "@/services/prospect-start";

/**
 * Server actions behind the instant-audit pages: the home page form starts
 * the audit, and the /audit page collects the visitor's details and offers
 * them a login while it runs. Types only are exported besides the actions.
 */

export interface AuditStartState {
  fieldErrors?: Record<string, string>;
  /** Echoed back so a failed submit doesn't wipe what they typed. */
  values?: Record<string, string>;
}

export interface DetailsState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  /** The address the report goes to, shown once details are in. */
  email?: string;
}

export interface AccountState {
  error?: string;
  /** Set when the address already has a login, so the form can point at the login page and offer another address. */
  reason?: "has-account";
  fieldErrors?: Record<string, string>;
}

const text = (formData: FormData, field: string): string => {
  const raw = formData.get(field);
  return typeof raw === "string" ? raw : "";
};

/** First message per field wins; a second one on the same input has nowhere to render. */
function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

const websiteField = z.string().trim()
  .min(1, "Enter your website, or say you don't have one.")
  .max(300, "That URL is too long.")
  .transform(withScheme)
  .refine(isSafeHttpUrl, "That doesn't look like a website address.");

const noWebsiteFields = z.object({
  practiceName: auditRequestSchema.shape.practiceName,
  category: z.string().trim().min(2, "Tell us what kind of business it is.").max(60, "Keep this under 60 characters."),
  location: z.string().trim().min(2, "Tell us the city or area.").max(80, "Keep this under 80 characters."),
});

const START_FIELDS = ["websiteUrl", "practiceName", "category", "location"] as const;

export async function startAudit(_prev: AuditStartState, formData: FormData): Promise<AuditStartState> {
  // Honeypot. Real people never see this input, so anything in it is a bot.
  if (text(formData, "fax").trim() !== "") redirect("/book");

  const values: Record<string, string> = {};
  for (const field of START_FIELDS) values[field] = text(formData, field);
  const noWebsite = text(formData, "noWebsite") === "1";
  if (noWebsite) values.noWebsite = "1";

  let input: Parameters<typeof startLead>[1];
  if (noWebsite) {
    const parsed = noWebsiteFields.safeParse(values);
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
    input = parsed.data;
  } else {
    const parsed = websiteField.safeParse(values.websiteUrl);
    if (!parsed.success) return { fieldErrors: { websiteUrl: parsed.error.issues[0].message }, values };
    input = { websiteUrl: parsed.data };
  }

  const db = getDb();
  const { id } = await startLead(db, input);
  if (await shouldPrepareLead(db, id).catch(() => false)) startProspectSetup(id);
  else await markNotPrepared(db, id).catch(() => undefined);
  redirect(`/audit/${id}`);
}

/** The report email's real send, the same one the setup uses when it finishes. */
const reportDeps = { sendAudit: (db: Db, practiceId: string, lead: { email: string; contactName: string }) => sendProspectReportFor(db, practiceId, lead) };

const detailsSchema = auditRequestSchema.pick({
  contactName: true, email: true, phone: true, practiceName: true, category: true, location: true,
});
const DETAIL_FIELDS = ["contactName", "email", "phone", "practiceName", "category", "location"] as const;

export async function submitDetails(leadId: string, _prev: DetailsState, formData: FormData): Promise<DetailsState> {
  const values: Record<string, string> = {};
  for (const field of DETAIL_FIELDS) values[field] = text(formData, field);
  const unknownLead: DetailsState = { status: "error", message: "We couldn't find this audit. Start a new one.", values };
  if (!isUuid(leadId)) return unknownLead;

  const db = getDb();
  // Details are taken once. After that the lead is the visitor's record and
  // the audit's address can't be used to change it or to ping the operator.
  const [existing] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!existing) return unknownLead;
  if (existing.email) return { status: "success", email: existing.email };

  // The name is read from their website a few seconds after the form is
  // drawn, so the box can still be empty when they press Continue. A blank
  // one means "the name you found", not a missing answer.
  if (!values.practiceName.trim() && existing.practiceName) values.practiceName = existing.practiceName;
  const parsed = detailsSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };

  const lead = await attachContact(db, leadId, parsed.data);
  if (!lead) return unknownLead;

  // Best effort: the details are saved, so a failed notice mustn't turn this into an error.
  await sendAuditRequest({
    ...parsed.data,
    websiteUrl: lead.websiteUrl ?? "No website",
    category: lead.category ?? "", location: lead.location ?? "", bestTimes: "",
  }).catch(() => undefined);

  // If the audit finished before they gave an address, the report goes out now.
  if (lead.status === "ready") {
    await sendReportOnce(db, leadId, reportDeps).catch(err => console.error(`report email for lead ${leadId} failed:`, err));
  }
  return { status: "success", email: parsed.data.email };
}

const emailField = auditRequestSchema.shape.email;

export async function createAccount(leadId: string, _prev: AccountState, formData: FormData): Promise<AccountState> {
  const password = text(formData, "password");
  if (!isUuid(leadId)) return { error: "We couldn't find this audit. Start a new one." };
  const db = getDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead) return { error: "We couldn't find this audit. Start a new one." };
  // The login is made while the audit runs, so it needs only the business,
  // which setup creates in its first moments. Before that there is nothing
  // to attach a login to.
  if (!lead.practiceId) return { error: "We're still setting up your audit. Try again in a few seconds." };

  // The lead's own address wins. A typed one is only taken when none is on
  // file, or when the one on file already has a login and so can never be
  // used here. Either way it is claimed on the lead first (one conditional
  // update, so two submits at once can't both win) and put back if no login
  // is made.
  const previous = lead.email;
  let email = previous;
  let claimed = false;
  const typed = text(formData, "email").trim();
  const replacing = !!previous && typed !== "" && typed.toLowerCase() !== previous.toLowerCase()
    && (await db.select({ id: users.id }).from(users).where(eq(users.email, previous.toLowerCase())).limit(1)).length > 0;
  if (!email || replacing) {
    const parsed = emailField.safeParse(typed);
    if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0].message } };
    email = parsed.data.toLowerCase();
    const [won] = await db.update(leads).set({ email })
      .where(and(eq(leads.id, leadId), previous ? eq(leads.email, previous) : isNull(leads.email))).returning({ id: leads.id });
    if (!won) return { error: accountErrorMessage("has-account"), reason: "has-account" };
    claimed = true;
  }
  const giveBack = () => db.update(leads).set({ email: previous }).where(eq(leads.id, leadId));

  let result;
  try {
    result = await createAccountFromAudit(db, lead.practiceId, email, password, loadEnv().OPERATOR_EMAIL);
  } catch (err) {
    if (claimed) await giveBack();
    throw err;
  }
  if (!result.ok) {
    if (claimed) await giveBack();
    return { error: accountErrorMessage(result.reason), ...(result.reason === "has-account" ? { reason: "has-account" as const } : {}) };
  }
  // An address that arrives after the audit finished gets the report now. One
  // that arrives mid-audit is picked up when the full audit finishes.
  if (claimed && lead.status === "ready") {
    await sendReportOnce(db, leadId, reportDeps).catch(err => console.error(`report email for lead ${leadId} failed:`, err));
  }

  try {
    // Signs in without letting the sign-in redirect by itself: it would go to
    // its configured address (AUTH_URL), and the site answers on others too.
    // The session cookie is set on the address the visitor is on, so that is
    // where they must stay.
    await signIn("credentials", { email: result.email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Your account is ready. Log in to continue." };
    throw error;
  }
  // On to the call step: the audit may still be running, and the dashboard comes after.
  redirect(`/audit/${leadId}?step=call`);
}

export interface PhoneState {
  saved?: boolean;
  error?: string;
}

/** The optional phone number from the call step, saved on the lead for whoever takes the call. */
export async function savePhone(leadId: string, _prev: PhoneState, formData: FormData): Promise<PhoneState> {
  const unknown: PhoneState = { error: "We couldn't find this audit. Start a new one." };
  if (!isUuid(leadId)) return unknown;
  const parsed = auditRequestSchema.shape.phone.safeParse(text(formData, "phone"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const [saved] = await getDb().update(leads).set({ phone: parsed.data || null }).where(eq(leads.id, leadId)).returning({ id: leads.id });
  return saved ? { saved: true } : unknown;
}
