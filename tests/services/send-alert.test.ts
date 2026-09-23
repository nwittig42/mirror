import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import * as schema from "@/db/schema";
import { composeAlert, alertableFindings, sendAlert } from "@/services/alert-email";
import type { NewFinding } from "@/services/scan-runner";

const finding = (over: Partial<NewFinding> = {}): NewFinding => ({
  claim: "Botox is $9 per unit",
  factValue: "$14/unit",
  severity: "critical",
  engine: "openai",
  prompt: "How much is Botox at Glow MedSpa?",
  ...over,
});

const args = (findings: NewFinding[]) => ({
  practiceName: "Glow MedSpa",
  slug: "glow",
  findings,
  appUrl: "https://app.example.com",
});

describe("alertableFindings", () => {
  it("drops minor findings", () => {
    const result = alertableFindings([
      finding({ severity: "minor", claim: "hours slightly off" }),
      finding({ severity: "major" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("major");
  });

  it("orders critical before major regardless of input order", () => {
    const result = alertableFindings([
      finding({ severity: "major", claim: "major one" }),
      finding({ severity: "critical", claim: "critical one" }),
    ]);
    expect(result.map(f => f.severity)).toEqual(["critical", "major"]);
  });
});

describe("composeAlert", () => {
  it("returns null when nothing clears the alerting bar", () => {
    expect(composeAlert(args([]))).toBeNull();
    expect(composeAlert(args([finding({ severity: "minor" })]))).toBeNull();
  });

  it("puts the practice and severity counts in the subject", () => {
    const composed = composeAlert(args([
      finding({ severity: "critical" }),
      finding({ severity: "major", claim: "Offers CoolSculpting" }),
      finding({ severity: "major", claim: "Open Sundays" }),
      finding({ severity: "minor", claim: "typo in bio" }),
    ]));
    expect(composed?.subject).toBe("Mirror alert: Glow MedSpa — 1 critical, 2 major");
  });

  it("omits a severity from the subject when it has no findings", () => {
    const composed = composeAlert(args([finding({ severity: "major" })]));
    expect(composed?.subject).toBe("Mirror alert: Glow MedSpa — 1 major");
  });

  it("shows the claim, the truth, the engine, and the prompt", () => {
    const composed = composeAlert(args([finding()]));
    expect(composed?.html).toContain("ChatGPT said:");
    expect(composed?.html).toContain("Botox is $9 per unit");
    expect(composed?.html).toContain("$14/unit");
    expect(composed?.html).toContain("How much is Botox at Glow MedSpa?");
  });

  it("flags a finding with no matching fact instead of showing a blank truth", () => {
    const composed = composeAlert(args([finding({ factValue: null })]));
    expect(composed?.html).toContain("No matching fact");
    expect(composed?.html).not.toContain("<strong>Truth:</strong>");
  });

  it("links to the practice's accuracy page", () => {
    const composed = composeAlert(args([finding()]));
    expect(composed?.html).toContain("https://app.example.com/dashboard/glow/accuracy");
  });

  it("marks itself internal so a forwarded copy can't be mistaken for the client email", () => {
    const composed = composeAlert(args([finding()]));
    expect(composed?.html).toContain("not sent to the client");
  });

  // `claim` is raw LLM output and `prompt` is operator-typed; neither is
  // trusted markup. Same requirement as composePulse's quote row.
  it("escapes markup in the claim and the prompt", () => {
    const composed = composeAlert(args([finding({
      claim: "<script>alert(1)</script>",
      prompt: "<img src=x onerror=alert(2)>",
      factValue: "<b>bold</b>",
    })]));
    expect(composed?.html).not.toContain("<script>");
    expect(composed?.html).not.toContain("<img src=x");
    expect(composed?.html).not.toContain("<b>bold</b>");
    expect(composed?.html).toContain("&lt;script&gt;");
  });
});

describe("sendAlert", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://x";
    process.env.OPENAI_API_KEY = "k";
    process.env.ANTHROPIC_API_KEY = "k";
    process.env.GEMINI_API_KEY = "k";
    process.env.PERPLEXITY_API_KEY = "k";
    process.env.RESEND_API_KEY = "k";
    process.env.CRON_SECRET = "s";
    process.env.AUTH_SECRET = "s";
    process.env.APP_URL = "http://localhost:3000";
    process.env.EMAIL_FROM = "alerts@mirror.example";
    delete process.env.ALERT_EMAIL;
    delete process.env.OPERATOR_EMAIL;
  });

  const practice = { id: "", name: "Glow MedSpa", slug: "glow" };

  it("sends to ALERT_EMAIL", async () => {
    process.env.ALERT_EMAIL = "nwittig@pipelinepath.io";
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });

    const transport = vi.fn().mockResolvedValue(undefined);
    await sendAlert(db, { ...practice, id: practiceId }, [finding()], transport);

    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0]).toMatchObject({
      to: "nwittig@pipelinepath.io",
      from: "alerts@mirror.example",
    });
  });

  it("falls back to OPERATOR_EMAIL when ALERT_EMAIL is unset", async () => {
    process.env.OPERATOR_EMAIL = "operator@mirror.example";
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });

    const transport = vi.fn().mockResolvedValue(undefined);
    await sendAlert(db, { ...practice, id: practiceId }, [finding()], transport);

    expect(transport.mock.calls[0][0]).toMatchObject({ to: "operator@mirror.example" });
  });

  it("sends nothing when the scan opened no alertable findings", async () => {
    process.env.ALERT_EMAIL = "nwittig@pipelinepath.io";
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });

    const transport = vi.fn().mockResolvedValue(undefined);
    await sendAlert(db, { ...practice, id: practiceId }, [finding({ severity: "minor" })], transport);
    await sendAlert(db, { ...practice, id: practiceId }, [], transport);

    expect(transport).not.toHaveBeenCalled();
  });

  // A flaky email provider must not fail the cron loop for the remaining
  // practices; the findings are already durably in the database either way.
  it("swallows a transport failure and logs it as an activity", async () => {
    process.env.ALERT_EMAIL = "nwittig@pipelinepath.io";
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });

    const transport = vi.fn().mockRejectedValue(new Error("resend down"));
    await expect(
      sendAlert(db, { ...practice, id: practiceId }, [finding()], transport),
    ).resolves.toBeUndefined();

    const activities = await db.select().from(schema.activities)
      .where(eq(schema.activities.practiceId, practiceId));
    expect(activities.some(a => a.description.includes("alert email failed"))).toBe(true);
    expect(activities.some(a => a.description.includes("resend down"))).toBe(true);
  });
});
