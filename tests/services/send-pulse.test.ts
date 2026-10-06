import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import * as schema from "@/db/schema";
import { sendPulse } from "@/services/pulse-email";

describe("sendPulse", () => {
  // sendPulse reads APP_URL/EMAIL_FROM via loadEnv() to build composePulse's
  // args even when a fake `transport` is injected, because these env vars aren't
  // read by the fake transport, but loadEnv() validates the whole schema.
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
  });


  it("composes and sends via the injected transport, using a name-variation-only mention for the quote", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing and Drain",
      slug: "harbor-plumbing",
      prompts: [{ text: "What are the best plumbers in Portland, Oregon?", kind: "category" }],
      members: ["dale@harbor-plumbing.example"],
    });

    // A second name variation, beyond the one seedPractice auto-adds
    // ("Harbor Plumbing and Drain" itself). The check below mentions ONLY this
    // variation, never the canonical name verbatim, to lock in the fix where
    // extractSnippet must search all variations, not just practice.name.
    await db.insert(schema.nameVariations).values({ practiceId, text: "Harbor Plumbing" });

    const [prompt] = await db.select().from(schema.prompts).where(eq(schema.prompts.practiceId, practiceId));
    const [scan] = await db.insert(schema.scans).values({
      practiceId, status: "complete", score: 42, startedAt: new Date(), finishedAt: new Date(),
    }).returning();
    const [check] = await db.insert(schema.checks).values({
      scanId: scan.id,
      promptId: prompt.id,
      engine: "perplexity",
      answerText: "Many customers love Harbor Plumbing for honest pricing. It's the best in town.",
      mentioned: true,
      position: "first",
    }).returning();
    await db.insert(schema.findings).values([
      { practiceId, checkId: check.id, claim: "Seen this scan", severity: "minor", status: "open", lastSeenScanId: scan.id },
      // Still open but not repeated by the latest scan: costs no points, so the
      // email doesn't count it either.
      { practiceId, checkId: check.id, claim: "Some stale claim", severity: "minor", status: "open" },
    ]);

    const transport = vi.fn().mockResolvedValue(undefined);
    await sendPulse(db, practiceId, transport);

    expect(transport).toHaveBeenCalledTimes(1);
    const call = transport.mock.calls[0][0];
    expect(call.to).toEqual(["dale@harbor-plumbing.example"]);
    expect(call.subject).toContain("Harbor Plumbing and Drain");
    expect(call.html).toContain("Many customers love Harbor Plumbing for honest pricing");
    expect(call.html).toContain("1 open accuracy issue");
  });

  // Review finding #17: the quoted sentence is the one the scan counted.
  // "Harbor Plumbing and Rose City Rooter" is one longer name to the matcher
  // unless the check's competitors are passed along, and the email then had
  // no quote at all.
  it("quotes a list answer that joins the business to a competitor by 'and'", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing and Drain",
      slug: "harbor-plumbing",
      prompts: [{ text: "What are the best plumbers in Portland, Oregon?", kind: "category" }],
      members: ["dale@harbor-plumbing.example"],
    });
    await db.insert(schema.nameVariations).values({ practiceId, text: "Harbor Plumbing" });
    const [prompt] = await db.select().from(schema.prompts).where(eq(schema.prompts.practiceId, practiceId));
    const [scan] = await db.insert(schema.scans).values({
      practiceId, status: "complete", score: 42, startedAt: new Date(), finishedAt: new Date(),
    }).returning();
    await db.insert(schema.checks).values({
      scanId: scan.id, promptId: prompt.id, engine: "perplexity",
      answerText: "Harbor Plumbing and Rose City Rooter are both good options. Call either one.",
      mentioned: true, position: "first",
      competitorsMentioned: ["Rose City Rooter"], namedOrder: ["Harbor Plumbing and Drain", "Rose City Rooter"],
    });

    const transport = vi.fn().mockResolvedValue(undefined);
    await sendPulse(db, practiceId, transport);
    expect(transport.mock.calls[0][0].html).toContain("Harbor Plumbing and Rose City Rooter are both good options");
  });

  it("counts only checks from prompts that didn't name the business", async () => {
    // The branded check below is a guaranteed mention: the question named the
    // practice. Counting it would tell a client who never surfaces in search
    // that AI cited them half the time.
    const db = await makeTestDb();
    const { practiceId, promptIds } = await seedPractice(db, {
      name: "Harbor Plumbing and Drain",
      slug: "harbor-plumbing",
      prompts: [
        { text: "What are the best plumbers in Portland, Oregon?", kind: "category" },
        { text: "What does Harbor Plumbing and Drain charge for a service call?", kind: "branded" },
      ],
      members: ["dale@harbor-plumbing.example"],
    });
    const [categoryPrompt, brandedPrompt] = promptIds;

    const [scan] = await db.insert(schema.scans).values({
      practiceId, status: "complete", score: 12, startedAt: new Date(), finishedAt: new Date(),
    }).returning();
    await db.insert(schema.checks).values([
      {
        scanId: scan.id, promptId: categoryPrompt, engine: "openai",
        answerText: "Try Rose City Rooter or Cascade Drain Pros.", mentioned: false, position: "absent",
      },
      {
        scanId: scan.id, promptId: brandedPrompt, engine: "openai",
        answerText: "Harbor Plumbing and Drain charges $89 for a service call.", mentioned: true, position: "first",
      },
    ]);

    const transport = vi.fn().mockResolvedValue(undefined);
    await sendPulse(db, practiceId, transport);

    const html = transport.mock.calls[0][0].html;
    expect(html).toContain("0 of 1");
    expect(html).not.toContain("1 of 2");
  });

  it("skips the week when no scan ran this week, instead of resending last week's", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing and Drain", members: ["dale@harbor-plumbing.example"] });
    const lastWeek = new Date(Date.now() - 7 * 86_400_000);
    await db.insert(schema.scans).values({ practiceId, status: "complete", score: 42, startedAt: lastWeek, finishedAt: lastWeek });
    const transport = vi.fn();
    await sendPulse(db, practiceId, transport);
    expect(transport).not.toHaveBeenCalled();
  });

  it("skips the week when the newest scan was blocked, instead of resending last week's", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing and Drain", members: ["dale@harbor-plumbing.example"] });
    const lastWeek = new Date(Date.now() - 7 * 86_400_000);
    await db.insert(schema.scans).values([
      { practiceId, status: "complete", score: 42, startedAt: lastWeek, finishedAt: lastWeek },
      { practiceId, status: "blocked", startedAt: new Date(), finishedAt: new Date() },
    ]);
    const transport = vi.fn();
    await sendPulse(db, practiceId, transport);
    expect(transport).not.toHaveBeenCalled();
  });

  it("skips silently when there is no complete scan", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Harbor Plumbing and Drain", members: ["dale@harbor-plumbing.example"] });
    const transport = vi.fn();
    await sendPulse(db, practiceId, transport);
    expect(transport).not.toHaveBeenCalled();
  });

  it("skips silently when the business has no members", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing and Drain",
      prompts: [{ text: "Best plumber in Portland", kind: "category" }],
    });
    const [prompt] = await db.select().from(schema.prompts);
    const [scan] = await db.insert(schema.scans).values({
      practiceId, status: "complete", score: 10, startedAt: new Date(), finishedAt: new Date(),
    }).returning();
    await db.insert(schema.checks).values({
      scanId: scan.id, promptId: prompt.id, engine: "openai", answerText: "hi",
      mentioned: false, position: "absent",
    });

    const transport = vi.fn();
    await sendPulse(db, practiceId, transport);
    expect(transport).not.toHaveBeenCalled();
  });

  it("logs an activity and does not throw when the transport fails", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing and Drain",
      prompts: [{ text: "Best plumber in Portland", kind: "category" }],
      members: ["dale@harbor-plumbing.example"],
    });
    const [prompt] = await db.select().from(schema.prompts);
    const [scan] = await db.insert(schema.scans).values({
      practiceId, status: "complete", score: 10, startedAt: new Date(), finishedAt: new Date(),
    }).returning();
    await db.insert(schema.checks).values({
      scanId: scan.id, promptId: prompt.id, engine: "openai", answerText: "hi",
      mentioned: false, position: "absent",
    });

    const transport = vi.fn().mockRejectedValue(new Error("resend down"));
    await expect(sendPulse(db, practiceId, transport)).resolves.toBeUndefined();

    const activities = await db.select().from(schema.activities).where(eq(schema.activities.practiceId, practiceId));
    expect(activities.some(a => a.description === "pulse email failed: resend down")).toBe(true);
  });
});
