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
      name: "Glow MedSpa",
      slug: "glow",
      prompts: [{ text: "Best med spa in Santa Monica for Botox", kind: "category" }],
      members: ["client@glow.example"],
    });

    // A second name variation, beyond the one seedPractice auto-adds
    // ("Glow MedSpa" itself). The check below mentions ONLY this variation,
    // never the canonical practice name verbatim, to lock in the fix where
    // extractSnippet must search all variations, not just practice.name.
    await db.insert(schema.nameVariations).values({ practiceId, text: "GlowSpa" });

    const [prompt] = await db.select().from(schema.prompts).where(eq(schema.prompts.practiceId, practiceId));
    const [scan] = await db.insert(schema.scans).values({
      practiceId, status: "complete", score: 42, startedAt: new Date(), finishedAt: new Date(),
    }).returning();
    const [check] = await db.insert(schema.checks).values({
      scanId: scan.id,
      promptId: prompt.id,
      engine: "perplexity",
      answerText: "Many patients love GlowSpa for natural results. It's the best in town.",
      mentioned: true,
      position: "first",
    }).returning();
    await db.insert(schema.findings).values({
      practiceId,
      checkId: check.id,
      claim: "Some stale claim",
      severity: "minor",
      status: "open",
    });

    const transport = vi.fn().mockResolvedValue(undefined);
    await sendPulse(db, practiceId, transport);

    expect(transport).toHaveBeenCalledTimes(1);
    const call = transport.mock.calls[0][0];
    expect(call.to).toEqual(["client@glow.example"]);
    expect(call.subject).toContain("Glow MedSpa");
    expect(call.html).toContain("Many patients love GlowSpa for natural results");
    expect(call.html).toContain("1 open accuracy issue");
  });

  it("counts only checks from prompts that didn't name the practice", async () => {
    // The branded check below is a guaranteed mention: the question named the
    // practice. Counting it would tell a client who never surfaces in search
    // that AI cited them half the time.
    const db = await makeTestDb();
    const { practiceId, promptIds } = await seedPractice(db, {
      name: "Glow MedSpa",
      slug: "glow",
      prompts: [
        { text: "Best med spa in Santa Monica for Botox", kind: "category" },
        { text: "How much does Botox cost at Glow MedSpa?", kind: "branded" },
      ],
      members: ["client@glow.example"],
    });
    const [categoryPrompt, brandedPrompt] = promptIds;

    const [scan] = await db.insert(schema.scans).values({
      practiceId, status: "complete", score: 12, startedAt: new Date(), finishedAt: new Date(),
    }).returning();
    await db.insert(schema.checks).values([
      {
        scanId: scan.id, promptId: categoryPrompt, engine: "openai",
        answerText: "Try Radiance Aesthetics or Dermacare.", mentioned: false, position: "absent",
      },
      {
        scanId: scan.id, promptId: brandedPrompt, engine: "openai",
        answerText: "Glow MedSpa charges $13 per unit.", mentioned: true, position: "first",
      },
    ]);

    const transport = vi.fn().mockResolvedValue(undefined);
    await sendPulse(db, practiceId, transport);

    const html = transport.mock.calls[0][0].html;
    expect(html).toContain("0 of 1");
    expect(html).not.toContain("1 of 2");
  });

  it("skips silently when there is no complete scan", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa", members: ["client@glow.example"] });
    const transport = vi.fn();
    await sendPulse(db, practiceId, transport);
    expect(transport).not.toHaveBeenCalled();
  });

  it("skips silently when the practice has no members", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa", kind: "category" }],
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
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa", kind: "category" }],
      members: ["client@glow.example"],
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
