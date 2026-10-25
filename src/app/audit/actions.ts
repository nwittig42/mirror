"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Db } from "@/db";
import { leads, scans } from "@/db/schema";
import { signIn } from "@/lib/auth";
import { loadEnv } from "@/lib/env";
import { isSafeHttpUrl } from "@/lib/url";
import { accountErrorMessage, createAccountFromAudit } from "@/services/account-invites";
import { auditProgress, isUuid } from "@/services/audit-progress";
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

  const parsed = detailsSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };

  const db = getDb();
  const lead = await attachContact(db, leadId, parsed.data);
  if (!lead) return unknownLead;

  // Best effort: the details are saved, so a failed notice mustn't turn this into an error.
  await sendAuditRequest({
    ...parsed.data,
    websiteUrl: lead.websiteUrl ?? "No website",
    category: lead.category ?? "", location: lead.location ?? "", bestTimes: "",
  }).catch(() => undefined);

  // If the audit finished before they gave an address, the report goes out now.
  if ((await auditProgress(db, leadId))?.stage === "done") {
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
  if (!lead?.practiceId) return { error: "We couldn't find this audit. Start a new one." };
  const [done] = await db.select({ id: scans.id }).from(scans)
    .where(and(eq(scans.practiceId, lead.practiceId), eq(scans.status, "complete"))).orderBy(desc(scans.startedAt)).limit(1);
  if (!done) return { error: "Your audit isn't finished yet. Try again in a moment." };

  // The lead's own address wins. A typed one is only taken when none is on file.
  let email = lead.email;
  if (!email) {
    const parsed = emailField.safeParse(text(formData, "email"));
    if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0].message } };
    email = parsed.data.toLowerCase();
  }

  const result = await createAccountFromAudit(db, lead.practiceId, email, password, loadEnv().OPERATOR_EMAIL);
  if (!result.ok) return { error: accountErrorMessage(result.reason) };

  if (!lead.email) {
    await db.update(leads).set({ email: result.email }).where(eq(leads.id, leadId));
    await sendReportOnce(db, leadId, reportDeps).catch(err => console.error(`report email for lead ${leadId} failed:`, err));
  }
  try {
    // Redirects (by throwing) to /app on success.
    await signIn("credentials", { email: result.email, password, redirectTo: "/app" });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Your account is ready. Log in to continue." };
    throw error;
  }
  return {};
}
