import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  auditRequestSchema,
  composeAuditRequest,
  sendAuditRequest,
  type AuditRequest,
  type AuditRequestTransportArgs,
} from "@/services/audit-request";

const VALID = {
  practiceName: "Glow MedSpa",
  websiteUrl: "https://glowmedspa.com",
  contactName: "Dr. Kim",
  email: "kim@glowmedspa.com",
  phone: "",
  bestTimes: "",
};

describe("auditRequestSchema", () => {
  it("accepts a complete request", () => {
    const parsed = auditRequestSchema.safeParse(VALID);
    expect(parsed.success).toBe(true);
  });

  it.each([
    ["practiceName", { practiceName: "" }],
    ["practiceName", { practiceName: "G" }],
    ["contactName", { contactName: "" }],
    ["email", { email: "kim@" }],
    ["email", { email: "not-an-email" }],
    ["websiteUrl", { websiteUrl: "" }],
  ])("rejects a bad %s", (field, override) => {
    const parsed = auditRequestSchema.safeParse({ ...VALID, ...override });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === field)).toBe(true);
    }
  });

  it("prefixes a bare domain with https so owners can type what they say", () => {
    const parsed = auditRequestSchema.safeParse({ ...VALID, websiteUrl: "glowmedspa.com" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.websiteUrl).toBe("https://glowmedspa.com");
  });

  it("leaves an explicit http:// url alone", () => {
    const parsed = auditRequestSchema.safeParse({ ...VALID, websiteUrl: "http://glowmedspa.com" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.websiteUrl).toBe("http://glowmedspa.com");
  });

  it("rejects a non-http(s) scheme rather than rendering it as a link", () => {
    // The composed email turns websiteUrl into an <a href>, so a javascript:
    // or data: scheme surviving validation would be a live link in our inbox.
    for (const hostile of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"]) {
      const parsed = auditRequestSchema.safeParse({ ...VALID, websiteUrl: hostile });
      expect(parsed.success, hostile).toBe(false);
    }
  });

  it("trims surrounding whitespace", () => {
    const parsed = auditRequestSchema.safeParse({ ...VALID, practiceName: "  Glow MedSpa  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.practiceName).toBe("Glow MedSpa");
  });
});

describe("composeAuditRequest", () => {
  const base: AuditRequest = { ...VALID };

  it("names the practice in the subject so the inbox is scannable", () => {
    expect(composeAuditRequest(base).subject).toBe("Audit request: Glow MedSpa");
  });

  it("escapes HTML in every visitor-supplied field", () => {
    const { subject, html } = composeAuditRequest({
      ...base,
      practiceName: '<script>alert("xss")</script>',
      contactName: "Dr. <b>Kim</b>",
      bestTimes: "mornings & evenings",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Dr. &lt;b&gt;Kim&lt;/b&gt;");
    expect(html).toContain("mornings &amp; evenings");
    // The subject is a plain-text header, so it is not escaped — asserted here
    // so a future change that interpolates it into HTML has to revisit this.
    expect(subject).toContain("<script>");
  });

  it("omits optional rows that were left blank", () => {
    const html = composeAuditRequest(base).html;
    expect(html).not.toContain("Phone");
    expect(html).not.toContain("Best times");
  });

  it("includes optional rows when supplied", () => {
    const html = composeAuditRequest({ ...base, phone: "310-555-0134", bestTimes: "weekday AM" }).html;
    expect(html).toContain("310-555-0134");
    expect(html).toContain("weekday AM");
  });
});

describe("sendAuditRequest", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.DATABASE_URL = "postgres://x";
    process.env.OPENAI_API_KEY = "k";
    process.env.ANTHROPIC_API_KEY = "k";
    process.env.GEMINI_API_KEY = "k";
    process.env.PERPLEXITY_API_KEY = "k";
    process.env.RESEND_API_KEY = "k";
    process.env.CRON_SECRET = "s";
    process.env.AUTH_SECRET = "s";
    process.env.APP_URL = "http://localhost:3000";
    process.env.EMAIL_FROM = "mirror@example.com";
    delete process.env.LEADS_EMAIL;
    delete process.env.OPERATOR_EMAIL;
  });

  function capture() {
    const calls: AuditRequestTransportArgs[] = [];
    return {
      calls,
      transport: async (args: AuditRequestTransportArgs) => {
        calls.push(args);
      },
    };
  }

  it("routes to LEADS_EMAIL when set", async () => {
    process.env.LEADS_EMAIL = "sales@mirror.example";
    process.env.OPERATOR_EMAIL = "ops@mirror.example";
    const { calls, transport } = capture();

    await sendAuditRequest(VALID, transport);

    expect(calls).toHaveLength(1);
    expect(calls[0].to).toEqual(["sales@mirror.example"]);
  });

  it("falls back to OPERATOR_EMAIL rather than dropping the lead", async () => {
    process.env.OPERATOR_EMAIL = "ops@mirror.example";
    const { calls, transport } = capture();

    await sendAuditRequest(VALID, transport);

    expect(calls[0].to).toEqual(["ops@mirror.example"]);
  });

  it("sets reply-to to the practice so the operator can answer inline", async () => {
    process.env.OPERATOR_EMAIL = "ops@mirror.example";
    const { calls, transport } = capture();

    await sendAuditRequest(VALID, transport);

    expect(calls[0].replyTo).toBe("kim@glowmedspa.com");
    expect(calls[0].from).toBe("mirror@example.com");
  });

  it("propagates transport failure so the caller can offer a fallback", async () => {
    process.env.OPERATOR_EMAIL = "ops@mirror.example";
    const failing = async () => {
      throw new Error("resend down");
    };

    await expect(sendAuditRequest(VALID, failing)).rejects.toThrow("resend down");
  });
});
