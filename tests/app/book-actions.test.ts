import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AuditRequest } from "@/services/audit-request";

// Only the I/O is replaced: the real schema still runs, so these tests cover
// the action's wiring (honeypot, error mapping, value echo) rather than
// re-testing validation, which audit-request.test.ts owns.
const sendAuditRequest = vi.fn<(req: AuditRequest) => Promise<void>>();
vi.mock("@/services/audit-request", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/audit-request")>()),
  sendAuditRequest: (req: AuditRequest) => sendAuditRequest(req),
}));

import { requestAudit, type BookingState } from "@/app/book/actions";

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
  beforeEach(() => {
    sendAuditRequest.mockReset();
    sendAuditRequest.mockResolvedValue(undefined);
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

  it("surfaces a mailto fallback when the send throws", async () => {
    process.env.LEADS_EMAIL = "sales@mirror.example";
    sendAuditRequest.mockRejectedValue(new Error("resend down"));

    const state = await requestAudit(IDLE, form(VALID));

    expect(state.status).toBe("error");
    expect(state.message).toBeTruthy();
    expect(state.fallbackEmail).toBe("sales@mirror.example");
    // The lead is still on screen, so they can retype nothing and retry.
    expect(state.values?.practiceName).toBe("Glow MedSpa");
  });
});
