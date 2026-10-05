import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AuditRequest } from "@/services/audit-request";

// Only the I/O is replaced: the real schema still runs, so these tests cover
// the action's wiring (honeypot, error mapping, value echo) rather than
// re-testing validation, which audit-request.test.ts owns.
const sendAuditRequest = vi.fn<(req: AuditRequest) => Promise<void>>();
const sendAuditConfirmation = vi.fn<(req: AuditRequest) => Promise<void>>();
vi.mock("@/services/audit-request", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/audit-request")>()),
  sendAuditRequest: (req: AuditRequest) => sendAuditRequest(req),
  sendAuditConfirmation: (req: AuditRequest) => sendAuditConfirmation(req),
}));

// The background setup (website reading, scanning) is tested on its own; here
// only that it is started, and for which lead.
const startProspectSetup = vi.fn<(leadId: string) => void>();
vi.mock("@/services/prospect-start", () => ({ startProspectSetup: (id: string) => startProspectSetup(id) }));

// Saving the lead is real (PGlite) unless a test makes it fail.
let failSave = false;
vi.mock("@/services/leads", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/services/leads")>();
  return { ...real, saveLead: (...a: Parameters<typeof real.saveLead>) => failSave ? Promise.reject(new Error("db down")) : real.saveLead(...a) };
});

import { requestAudit, type BookingState } from "@/app/book/actions";
import { makeTestDb } from "../helpers/db";
import { setDbForTests, getDb } from "@/db";
import * as schema from "@/db/schema";

const IDLE: BookingState = { status: "idle" };

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const VALID = {
  practiceName: "Glow MedSpa",
  websiteUrl: "glowmedspa.com",
  contactName: "Dr. Kim",
  email: "kim@glowmedspa.com",
  phone: "",
  bestTimes: "",
};

describe("requestAudit", () => {
  beforeEach(async () => {
    setDbForTests(await makeTestDb());
    failSave = false;
    startProspectSetup.mockReset();
    sendAuditRequest.mockReset();
    sendAuditRequest.mockResolvedValue(undefined);
    sendAuditConfirmation.mockReset();
    sendAuditConfirmation.mockResolvedValue(undefined);
  });

  it("emails the prospect a confirmation after the lead is sent", async () => {
    await requestAudit(IDLE, form(VALID));
    expect(sendAuditConfirmation).toHaveBeenCalledOnce();
    expect(sendAuditConfirmation.mock.calls[0][0]).toMatchObject({ email: "kim@glowmedspa.com" });
  });

  it("still reports success when only the confirmation fails", async () => {
    sendAuditConfirmation.mockRejectedValue(new Error("resend down"));
    const state = await requestAudit(IDLE, form(VALID));
    expect(state.status).toBe("success");
  });

  it("sends no confirmation when the lead could be neither saved nor sent", async () => {
    failSave = true;
    sendAuditRequest.mockRejectedValue(new Error("resend down"));
    await requestAudit(IDLE, form(VALID));
    expect(sendAuditConfirmation).not.toHaveBeenCalled();
  });

  it("sends the normalized request and reports success", async () => {
    const state = await requestAudit(IDLE, form(VALID));

    expect(state.status).toBe("success");
    expect(sendAuditRequest).toHaveBeenCalledOnce();
    expect(sendAuditRequest.mock.calls[0][0]).toMatchObject({
      practiceName: "Glow MedSpa",
      // Normalized by the schema on the way through.
      websiteUrl: "https://glowmedspa.com",
      email: "kim@glowmedspa.com",
    });
  });

  it("swallows a honeypot submission without sending", async () => {
    // Reported as success on purpose: an error tells the bot what tripped it.
    const state = await requestAudit(IDLE, form({ ...VALID, fax: "http://spam.example" }));

    expect(state.status).toBe("success");
    expect(sendAuditRequest).not.toHaveBeenCalled();
  });

  it("maps validation failures to per-field errors and never sends", async () => {
    const state = await requestAudit(IDLE, form({ ...VALID, practiceName: "", email: "nope" }));

    expect(state.status).toBe("error");
    expect(state.fieldErrors).toHaveProperty("practiceName");
    expect(state.fieldErrors).toHaveProperty("email");
    expect(sendAuditRequest).not.toHaveBeenCalled();
  });

  it("echoes submitted values back so a rejected form is not wiped", async () => {
    const state = await requestAudit(IDLE, form({ ...VALID, email: "nope" }));

    expect(state.values?.practiceName).toBe("Glow MedSpa");
    expect(state.values?.email).toBe("nope");
  });

  it("surfaces a mailto fallback when the lead could be neither saved nor sent", async () => {
    process.env.LEADS_EMAIL = "sales@mirror.example";
    failSave = true;
    sendAuditRequest.mockRejectedValue(new Error("resend down"));

    const state = await requestAudit(IDLE, form(VALID));

    expect(state.status).toBe("error");
    expect(state.message).toBeTruthy();
    expect(state.fallbackEmail).toBe("sales@mirror.example");
    // The lead is still on screen, so they can retype nothing and retry.
    expect(state.values?.practiceName).toBe("Glow MedSpa");
  });

  it("saves the lead and starts preparing their report", async () => {
    const state = await requestAudit(IDLE, form(VALID));
    expect(state.status).toBe("success");
    const [lead] = await getDb().select().from(schema.leads);
    expect(lead).toMatchObject({ practiceName: "Glow MedSpa", email: "kim@glowmedspa.com", status: "preparing" });
    expect(startProspectSetup).toHaveBeenCalledWith(lead.id);
  });

  it("still succeeds, and still prepares the report, when only the email fails", async () => {
    sendAuditRequest.mockRejectedValue(new Error("resend down"));
    const state = await requestAudit(IDLE, form(VALID));
    expect(state.status).toBe("success");
    expect(await getDb().select().from(schema.leads)).toHaveLength(1);
    expect(startProspectSetup).toHaveBeenCalledOnce();
  });

  it("still emails the lead when saving fails, and starts nothing", async () => {
    failSave = true;
    const state = await requestAudit(IDLE, form(VALID));
    expect(state.status).toBe("success");
    expect(sendAuditRequest).toHaveBeenCalledOnce();
    expect(startProspectSetup).not.toHaveBeenCalled();
  });

  it("saves nothing for a bot", async () => {
    await requestAudit(IDLE, form({ ...VALID, fax: "http://spam.example" }));
    expect(await getDb().select().from(schema.leads)).toHaveLength(0);
    expect(startProspectSetup).not.toHaveBeenCalled();
  });

  it("doesn't scan the same website twice in a day, and says so on the lead", async () => {
    await requestAudit(IDLE, form(VALID));
    await requestAudit(IDLE, form(VALID));
    expect(startProspectSetup).toHaveBeenCalledOnce();
    const rows = await getDb().select().from(schema.leads);
    const skipped = rows.find(r => r.status === "needs_attention");
    expect(skipped?.note).toMatch(/not set up automatically/i);
  });
});
