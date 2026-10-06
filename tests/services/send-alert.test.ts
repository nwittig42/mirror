import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import * as schema from "@/db/schema";
import { composeAlert, composeBlockedAlert, composeDispatchAlert, composeProspectAlert, alertableFindings, sendAlert } from "@/services/alert-email";
import type { NewFinding } from "@/services/scan-runner";

const finding = (over: Partial<NewFinding> = {}): NewFinding => ({
  claim: "A service call is $49",
  factValue: "$89 diagnostic fee",
  severity: "critical",
  engine: "openai",
  prompt: "What does Harbor Plumbing and Drain charge for a service call?",
  ...over,
});

const args = (findings: NewFinding[]) => ({
  practiceName: "Harbor Plumbing and Drain",
  slug: "harbor-plumbing",
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

  it("puts the business and severity counts in the subject", () => {
    const composed = composeAlert(args([
      finding({ severity: "critical" }),
      finding({ severity: "major", claim: "Offers 24/7 emergency service" }),
      finding({ severity: "major", claim: "Open Sundays" }),
      finding({ severity: "minor", claim: "typo in bio" }),
    ]));
    expect(composed?.subject).toBe("Mirror alert for Harbor Plumbing and Drain: 1 critical, 2 major");
  });

  it("omits a severity from the subject when it has no findings", () => {
    const composed = composeAlert(args([finding({ severity: "major" })]));
    expect(composed?.subject).toBe("Mirror alert for Harbor Plumbing and Drain: 1 major");
  });

  it("shows the claim, the truth, the engine, and the prompt", () => {
    const composed = composeAlert(args([finding()]));
    expect(composed?.html).toContain("ChatGPT said:");
    expect(composed?.html).toContain("A service call is $49");
    expect(composed?.html).toContain("$89 diagnostic fee");
    expect(composed?.html).toContain("What does Harbor Plumbing and Drain charge for a service call?");
  });

  it("flags a finding with no matching fact instead of showing a blank truth", () => {
    const composed = composeAlert(args([finding({ factValue: null })]));
    expect(composed?.html).toContain("No matching fact");
    expect(composed?.html).not.toContain("<strong>Truth:</strong>");
  });

  // The operator reads this on a phone between jobs; an em dash in a subject
  // line or a body is the one typographic rule the product keeps everywhere.
  it("uses no em dash in the subject or the body", () => {
    const composed = composeAlert(args([finding(), finding({ factValue: null, severity: "major" })]));
    expect(composed?.subject).not.toContain("\u2014");
    expect(composed?.html).not.toContain("\u2014");
    expect(composed?.html).not.toContain("&mdash;");
  });

  it("links to the business's accuracy page", () => {
    const composed = composeAlert(args([finding()]));
    expect(composed?.html).toContain("https://app.example.com/dashboard/harbor-plumbing/accuracy");
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

  const practice = { id: "", name: "Harbor Plumbing and Drain", slug: "harbor-plumbing" };

  it("sends to ALERT_EMAIL", async () => {
    process.env.ALERT_EMAIL = "nwittig@pipelinepath.io";
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing and Drain" });

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
    const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing and Drain" });

    const transport = vi.fn().mockResolvedValue(undefined);
    await sendAlert(db, { ...practice, id: practiceId }, [finding()], transport);

    expect(transport.mock.calls[0][0]).toMatchObject({ to: "operator@mirror.example" });
  });

  it("sends nothing when the scan opened no alertable findings", async () => {
    process.env.ALERT_EMAIL = "nwittig@pipelinepath.io";
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing and Drain" });

    const transport = vi.fn().mockResolvedValue(undefined);
    await sendAlert(db, { ...practice, id: practiceId }, [finding({ severity: "minor" })], transport);
    await sendAlert(db, { ...practice, id: practiceId }, [], transport);

    expect(transport).not.toHaveBeenCalled();
  });

  // A flaky email provider must not fail the cron loop for the remaining
  // businesses; the findings are already durably in the database either way.
  it("swallows a transport failure and logs it as an activity", async () => {
    process.env.ALERT_EMAIL = "nwittig@pipelinepath.io";
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing and Drain" });

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

describe("composeBlockedAlert", () => {
  it("says the scan was held back and why, escaping the reason", () => {
    const { subject, html } = composeBlockedAlert({
      practiceName: "Harbor Plumbing and Drain", slug: "harbor-plumbing", appUrl: "https://app.example.com",
      reason: "Only 40% of answers came back. <Gemini> didn't respond.",
    });
    expect(subject).toBe("Mirror: scan blocked for Harbor Plumbing and Drain");
    expect(html).toContain("&lt;Gemini&gt;");
    expect(html).toContain("Last week's score stays up");
  });
});

describe("composeDispatchAlert", () => {
  it("lists the businesses whose scan never started", () => {
    const out = composeDispatchAlert([
      { practice: "harbor-plumbing", dispatched: false, error: "Error: scan-practice 401" },
      { practice: "rose-city-rooter", dispatched: true },
    ]);
    expect(out?.subject).toBe("Mirror: 1 weekly scan didn't start");
    expect(out?.html).toContain("harbor-plumbing");
    expect(out?.html).not.toContain("rose-city-rooter");
  });
  it("is null when every scan started", () => {
    expect(composeDispatchAlert([{ practice: "harbor-plumbing", dispatched: true }])).toBeNull();
  });
});

describe("composeProspectAlert", () => {
  it("says the report is ready and links straight to the customer", () => {
    const out = composeProspectAlert({ practiceName: "Harbor <Plumbing>", practiceId: "p1", status: "ready", note: null, appUrl: "https://app.example" });
    expect(out.subject).toBe("Report ready: Harbor <Plumbing>. Review it before the call");
    expect(out.html).toContain("Harbor &lt;Plumbing&gt;");
    expect(out.html).toContain("https://app.example/admin/practices/p1/overview");
  });
  it("says what needs a look when setup hit a problem", () => {
    const out = composeProspectAlert({ practiceName: "Harbor", practiceId: "p1", status: "needs_attention", note: "Their website couldn't be read.", appUrl: "https://app.example" });
    expect(out.subject).toBe("Needs a look: Harbor's report");
    expect(out.html).toContain("couldn&#39;t be read");
  });
});
