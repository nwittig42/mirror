import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AuditRequest } from "@/services/audit-request";

// Only the I/O is replaced; the database is a real PGlite one.
const sendAuditRequest = vi.fn<(req: AuditRequest) => Promise<void>>();
const sendAuditConfirmation = vi.fn();
vi.mock("@/services/audit-request", async importOriginal => ({
  ...(await importOriginal<typeof import("@/services/audit-request")>()),
  sendAuditRequest: (req: AuditRequest) => sendAuditRequest(req),
  sendAuditConfirmation: (...a: unknown[]) => sendAuditConfirmation(...a),
}));

const startProspectSetup = vi.fn<(leadId: string) => void>();
vi.mock("@/services/prospect-start", () => ({ startProspectSetup: (id: string) => startProspectSetup(id) }));

const sendProspectReportFor = vi.fn();
vi.mock("@/services/prospect-audit-email", () => ({ sendProspectReportFor: (...a: unknown[]) => sendProspectReportFor(...a) }));

vi.mock("@/lib/env", () => ({ loadEnv: () => ({ OPERATOR_EMAIL: "operator@example.com" }) }));

// signIn redirects on success by throwing; stand in for that.
const signIn = vi.fn();
vi.mock("@/lib/auth", () => ({ signIn: (...a: unknown[]) => signIn(...a) }));

import { startAudit, submitDetails, createAccount, type AuditStartState, type DetailsState, type AccountState } from "@/app/audit/actions";
import { redeem, type RedeemState } from "@/app/welcome/actions";
import { createInvite } from "@/services/account-invites";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests, getDb } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const redirectsTo = (path: string | RegExp) =>
  expect.objectContaining({ digest: expect.stringMatching(typeof path === "string" ? new RegExp(`NEXT_REDIRECT;[a-z]+;${path};`) : path) });

const START: AuditStartState = {};
const DETAILS: DetailsState = { status: "idle" };
const ACCOUNT: AccountState = {};
const REDEEM: RedeemState = {};
const SIGNED_IN = new Error("NEXT_REDIRECT signed in");

beforeEach(async () => {
  setDbForTests(await makeTestDb());
  for (const m of [startProspectSetup, sendAuditRequest, sendAuditConfirmation, sendProspectReportFor, signIn]) m.mockReset();
  sendAuditRequest.mockResolvedValue(undefined);
  sendProspectReportFor.mockResolvedValue(undefined);
  signIn.mockRejectedValue(SIGNED_IN);
});

const allLeads = () => getDb().select().from(schema.leads);

describe("startAudit", () => {
  it("saves a lead from a website, starts its setup and sends the visitor to the audit page", async () => {
    await expect(startAudit(START, form({ websiteUrl: "glowmedspa.com" }))).rejects.toEqual(redirectsTo("/audit/[0-9a-f-]{36}"));
    const [lead] = await allLeads();
    expect(lead).toMatchObject({ websiteUrl: "https://glowmedspa.com", nameFromSite: true, practiceName: null });
    expect(startProspectSetup).toHaveBeenCalledWith(lead.id);
  });

  it("redirects to the lead's own page", async () => {
    const err = await startAudit(START, form({ websiteUrl: "glowmedspa.com" })).catch(e => e);
    const [lead] = await allLeads();
    expect(err.digest).toContain(`/audit/${lead.id}`);
  });

  it("gives a bad website an error and echoes what was typed", async () => {
    const state = await startAudit(START, form({ websiteUrl: "javascript:alert(1)" }));
    expect(state.fieldErrors).toHaveProperty("websiteUrl");
    expect(state.values?.websiteUrl).toBe("javascript:alert(1)");
    expect(await allLeads()).toHaveLength(0);
    expect(startProspectSetup).not.toHaveBeenCalled();
  });

  it("needs a website unless they say they have none", async () => {
    const state = await startAudit(START, form({ websiteUrl: "" }));
    expect(state.fieldErrors).toHaveProperty("websiteUrl");
  });

  it("with no website, needs the name, the kind of business and the city", async () => {
    const state = await startAudit(START, form({ noWebsite: "1", practiceName: "Glow" }));
    expect(state.fieldErrors).toHaveProperty("category");
    expect(state.fieldErrors).toHaveProperty("location");
    expect(state.fieldErrors).not.toHaveProperty("practiceName");
    expect(await allLeads()).toHaveLength(0);
  });

  it("with no website, saves the lead from what they typed", async () => {
    await expect(startAudit(START, form({
      noWebsite: "1", practiceName: " Glow ", category: "Med spa", location: "Portland, OR",
    }))).rejects.toEqual(redirectsTo("/audit/[0-9a-f-]{36}"));
    const [lead] = await allLeads();
    expect(lead).toMatchObject({ websiteUrl: null, practiceName: "Glow", category: "Med spa", location: "Portland, OR" });
    expect(startProspectSetup).toHaveBeenCalledWith(lead.id);
  });

  it("saves a repeat of the same site without scanning it again", async () => {
    await startAudit(START, form({ websiteUrl: "glowmedspa.com" })).catch(() => undefined);
    await startAudit(START, form({ websiteUrl: "glowmedspa.com" })).catch(() => undefined);
    expect(startProspectSetup).toHaveBeenCalledOnce();
    expect((await allLeads()).filter(l => l.status === "needs_attention")).toHaveLength(1);
  });

  it("sends a bot to /book and saves nothing", async () => {
    await expect(startAudit(START, form({ websiteUrl: "glowmedspa.com", fax: "x" }))).rejects.toEqual(redirectsTo("/book"));
    expect(await allLeads()).toHaveLength(0);
    expect(startProspectSetup).not.toHaveBeenCalled();
  });
});

async function readyLead(over: Partial<typeof schema.leads.$inferInsert> = {}, scan: "complete" | "running" | null = "complete") {
  const seeded = await seedPractice(getDb(), { name: "Glow", website: "https://glow.example" });
  const [lead] = await getDb().insert(schema.leads).values({
    websiteUrl: "https://glow.example", practiceName: "Glow", practiceId: seeded.practiceId, status: "ready", ...over,
  }).returning();
  if (scan) await getDb().insert(schema.scans).values({ practiceId: seeded.practiceId, status: scan, totalTasks: 1 });
  return { lead, practiceId: seeded.practiceId };
}

const DETAIL_FIELDS = { contactName: "Dr. Kim", email: "Kim@Glow.example", phone: "", practiceName: "Glow", category: "", location: "" };

describe("submitDetails", () => {
  it("attaches the contact to the lead and tells the operator", async () => {
    const [lead] = await getDb().insert(schema.leads).values({ websiteUrl: "https://glow.example" }).returning();
    const state = await submitDetails(lead.id, DETAILS, form(DETAIL_FIELDS));
    expect(state).toEqual({ status: "success", email: "Kim@Glow.example" });
    const [row] = await allLeads();
    expect(row).toMatchObject({ contactName: "Dr. Kim", email: "kim@glow.example", practiceName: "Glow" });
    expect(sendAuditRequest).toHaveBeenCalledOnce();
    expect(sendAuditRequest.mock.calls[0][0]).toMatchObject({ contactName: "Dr. Kim", websiteUrl: "https://glow.example" });
    // No "request received" email to the visitor: the report is what they get.
    expect(sendAuditConfirmation).not.toHaveBeenCalled();
    expect(sendProspectReportFor).not.toHaveBeenCalled();
  });

  it("reports field errors and saves nothing", async () => {
    const [lead] = await getDb().insert(schema.leads).values({ websiteUrl: "https://glow.example" }).returning();
    const state = await submitDetails(lead.id, DETAILS, form({ ...DETAIL_FIELDS, email: "nope", contactName: "" }));
    expect(state.status).toBe("error");
    expect(state.fieldErrors).toHaveProperty("email");
    expect(state.fieldErrors).toHaveProperty("contactName");
    expect((await allLeads())[0].email).toBeNull();
  });

  it("is an error for a lead that doesn't exist, or an id that isn't one", async () => {
    expect((await submitDetails("00000000-0000-4000-8000-000000000000", DETAILS, form(DETAIL_FIELDS))).status).toBe("error");
    expect((await submitDetails("x'; drop table leads;--", DETAILS, form(DETAIL_FIELDS))).status).toBe("error");
  });

  it("still succeeds when the operator email fails", async () => {
    sendAuditRequest.mockRejectedValue(new Error("resend down"));
    const [lead] = await getDb().insert(schema.leads).values({ websiteUrl: "https://glow.example" }).returning();
    expect((await submitDetails(lead.id, DETAILS, form(DETAIL_FIELDS))).status).toBe("success");
  });

  it("runs once: a second submit on a lead that has an email changes nothing and sends no notice", async () => {
    const [lead] = await getDb().insert(schema.leads).values({ websiteUrl: "https://glow.example" }).returning();
    await submitDetails(lead.id, DETAILS, form(DETAIL_FIELDS));
    sendAuditRequest.mockClear();
    const state = await submitDetails(lead.id, DETAILS, form({ ...DETAIL_FIELDS, email: "evil@x.example", contactName: "Eve", practiceName: "Renamed" }));
    expect(state).toEqual({ status: "success", email: "kim@glow.example" });
    expect((await allLeads())[0]).toMatchObject({ email: "kim@glow.example", contactName: "Dr. Kim", practiceName: "Glow" });
    expect(sendAuditRequest).not.toHaveBeenCalled();
  });

  it("holds the report back for a lead that isn't ready, even if its scan is complete", async () => {
    const { lead } = await readyLead({ status: "preparing" });
    await submitDetails(lead.id, DETAILS, form(DETAIL_FIELDS));
    expect(sendProspectReportFor).not.toHaveBeenCalled();
  });

  it("sends the report once when the audit was already done", async () => {
    const { lead } = await readyLead();
    await submitDetails(lead.id, DETAILS, form(DETAIL_FIELDS));
    await submitDetails(lead.id, DETAILS, form(DETAIL_FIELDS));
    expect(sendProspectReportFor).toHaveBeenCalledOnce();
    expect(sendProspectReportFor.mock.calls[0][2]).toEqual({ email: "kim@glow.example", contactName: "Dr. Kim" });
  });

  it("holds the report back while the audit is still running", async () => {
    const { lead } = await readyLead({ status: "preparing" }, "running");
    await submitDetails(lead.id, DETAILS, form(DETAIL_FIELDS));
    expect(sendProspectReportFor).not.toHaveBeenCalled();
  });
});

describe("createAccount", () => {
  it("makes the login with the lead's own email and signs them in", async () => {
    const { lead } = await readyLead({ email: "owner@glow.example" });
    await expect(createAccount(lead.id, ACCOUNT, form({ password: "correct horse battery", email: "evil@x.example" }))).rejects.toBe(SIGNED_IN);
    const [user] = await getDb().select().from(schema.users);
    expect(user.email).toBe("owner@glow.example");
    expect(signIn).toHaveBeenCalledWith("credentials", { email: "owner@glow.example", password: "correct horse battery", redirectTo: "/app" });
  });

  it("takes the email from the form when the lead has none, and keeps it on the lead", async () => {
    const { lead } = await readyLead();
    await expect(createAccount(lead.id, ACCOUNT, form({ password: "correct horse battery", email: "New@Glow.example" }))).rejects.toBe(SIGNED_IN);
    const [row] = await getDb().select().from(schema.leads).where(eq(schema.leads.id, lead.id));
    expect(row.email).toBe("new@glow.example");
    expect(signIn.mock.calls[0][1]).toMatchObject({ email: "new@glow.example" });
  });

  it("refuses an address that already has a password, with a hint to log in", async () => {
    const { lead } = await readyLead({ email: "owner@glow.example" });
    await getDb().insert(schema.users).values({ email: "owner@glow.example", role: "client", passwordHash: "x" });
    const state = await createAccount(lead.id, ACCOUNT, form({ password: "correct horse battery" }));
    expect(state.error).toMatch(/log in/i);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("refuses a second login for the same business, whatever the email", async () => {
    const { lead } = await readyLead();
    await expect(createAccount(lead.id, ACCOUNT, form({ password: "correct horse battery", email: "a@glow.example" }))).rejects.toBe(SIGNED_IN);
    await getDb().update(schema.leads).set({ email: null }).where(eq(schema.leads.id, lead.id));
    const state = await createAccount(lead.id, ACCOUNT, form({ password: "correct horse battery", email: "b@glow.example" }));
    expect(state.error).toMatch(/log in/i);
    expect(await getDb().select().from(schema.users)).toHaveLength(1);
    expect((await getDb().select().from(schema.leads))[0].email).toBeNull();
  });

  it("leaves no address on the lead when the login is refused", async () => {
    const { lead } = await readyLead();
    await getDb().insert(schema.users).values({ email: "taken@x.example", role: "client", passwordHash: "x" });
    await createAccount(lead.id, ACCOUNT, form({ password: "correct horse battery", email: "taken@x.example" }));
    expect((await getDb().select().from(schema.leads))[0].email).toBeNull();
  });

  it("refuses a weak password", async () => {
    const { lead } = await readyLead({ email: "owner@glow.example" });
    const state = await createAccount(lead.id, ACCOUNT, form({ password: "short" }));
    expect(state.error).toBeTruthy();
    expect(await getDb().select().from(schema.users)).toHaveLength(0);
  });

  it("needs a complete scan", async () => {
    const { lead } = await readyLead({ email: "owner@glow.example", status: "preparing" }, "running");
    const state = await createAccount(lead.id, ACCOUNT, form({ password: "correct horse battery" }));
    expect(state.error).toBeTruthy();
    expect(await getDb().select().from(schema.users)).toHaveLength(0);
  });

  it("needs a valid email when the lead has none", async () => {
    const { lead } = await readyLead();
    const state = await createAccount(lead.id, ACCOUNT, form({ password: "correct horse battery", email: "nope" }));
    expect(state.fieldErrors).toHaveProperty("email");
  });

  it("refuses an id that isn't a UUID", async () => {
    expect((await createAccount("nope", ACCOUNT, form({ password: "correct horse battery" }))).error).toBeTruthy();
  });
});

describe("redeem", () => {
  it("uses the link, makes the login and signs them in", async () => {
    const { practiceId } = await readyLead();
    const token = await createInvite(getDb(), practiceId, "owner@glow.example");
    await expect(redeem(REDEEM, form({ token, password: "correct horse battery" }))).rejects.toBe(SIGNED_IN);
    expect(signIn).toHaveBeenCalledWith("credentials", { email: "owner@glow.example", password: "correct horse battery", redirectTo: "/app" });
  });

  it("explains a link that is no good", async () => {
    const state = await redeem(REDEEM, form({ token: "bogus", password: "correct horse battery" }));
    expect(state.error).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("points someone who already has a password to log in", async () => {
    const { practiceId } = await readyLead();
    await getDb().insert(schema.users).values({ email: "owner@glow.example", role: "client", passwordHash: "x" });
    const token = await createInvite(getDb(), practiceId, "owner@glow.example");
    expect((await redeem(REDEEM, form({ token, password: "correct horse battery" }))).error).toMatch(/log in/i);
  });
});
