import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { auditProgress, isUuid } from "@/services/audit-progress";

let db: Db;
beforeEach(async () => { db = await makeTestDb(); });

async function lead(values: Partial<typeof schema.leads.$inferInsert> = {}) {
  const [row] = await db.insert(schema.leads).values({ websiteUrl: "https://glow.example", ...values }).returning();
  return row;
}

async function withPractice(values: Partial<typeof schema.leads.$inferInsert> = {}) {
  const seeded = await seedPractice(db, { name: "Glow", prompts: [{ text: "best spa?", kind: "category" }] });
  return { seeded, row: await lead({ practiceId: seeded.practiceId, ...values }) };
}

async function answers(scanId: string, promptId: string, n: number) {
  for (let run = 1; run <= n; run++) {
    await db.insert(schema.scanAnswers).values({ scanId, promptId, run, engine: "openai", ok: true });
  }
}

describe("auditProgress", () => {
  it("is null for an unknown lead", async () => {
    expect(await auditProgress(db, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("reads while there is no business yet", async () => {
    const row = await lead();
    expect(await auditProgress(db, row.id)).toMatchObject({ stage: "reading", percent: 5, hasEmail: false, email: null });
  });

  it("is not-started for a lead skipped by the cap, with no business", async () => {
    const row = await lead({ status: "needs_attention" });
    expect(await auditProgress(db, row.id)).toMatchObject({ stage: "not-started" });
  });

  it("fails a needs-attention lead that has a business", async () => {
    const { row } = await withPractice({ status: "needs_attention" });
    expect(await auditProgress(db, row.id)).toMatchObject({ stage: "failed" });
  });

  it("keeps reading, a little further on, once the questions exist but no scan has started", async () => {
    const { row } = await withPractice();
    expect(await auditProgress(db, row.id)).toMatchObject({ stage: "reading", percent: 15 });
  });

  it("reads a little less far on when the business has no questions yet", async () => {
    const seeded = await seedPractice(db, { name: "Glow" });
    const row = await lead({ practiceId: seeded.practiceId });
    expect(await auditProgress(db, row.id)).toMatchObject({ stage: "reading", percent: 8 });
  });

  it("asks, scaled by answers in, while the scan runs", async () => {
    const { seeded, row } = await withPractice({ email: "a@b.co", practiceName: "Glow" });
    const [scan] = await db.insert(schema.scans).values({ practiceId: seeded.practiceId, totalTasks: 4 }).returning();
    await answers(scan.id, seeded.promptIds[0], 1);
    expect(await auditProgress(db, row.id)).toEqual({
      stage: "asking", percent: 34, answers: 1, total: 4, businessName: "Glow", hasEmail: true, email: "a@b.co",
    });
  });

  it("writes once every answer is in but the scan is still running", async () => {
    const { seeded, row } = await withPractice();
    const [scan] = await db.insert(schema.scans).values({ practiceId: seeded.practiceId, totalTasks: 2 }).returning();
    await answers(scan.id, seeded.promptIds[0], 2);
    expect(await auditProgress(db, row.id)).toMatchObject({ stage: "writing", percent: 95, answers: 2, total: 2 });
  });

  it("is done when the latest scan is complete", async () => {
    const { seeded, row } = await withPractice();
    await db.insert(schema.scans).values({ practiceId: seeded.practiceId, status: "complete", totalTasks: 2 });
    expect(await auditProgress(db, row.id)).toMatchObject({ stage: "done", percent: 100 });
  });

  it("is done when the lead is ready", async () => {
    const { row } = await withPractice({ status: "ready" });
    expect(await auditProgress(db, row.id)).toMatchObject({ stage: "done", percent: 100 });
  });

  it.each(["failed", "blocked"] as const)("fails when the latest scan is %s", async status => {
    const { seeded, row } = await withPractice();
    await db.insert(schema.scans).values({ practiceId: seeded.practiceId, status });
    expect(await auditProgress(db, row.id)).toMatchObject({ stage: "failed" });
  });

  it("judges by the latest scan, not an older one", async () => {
    const { seeded, row } = await withPractice();
    await db.insert(schema.scans).values({ practiceId: seeded.practiceId, status: "failed", startedAt: new Date(Date.now() - 60_000) });
    await db.insert(schema.scans).values({ practiceId: seeded.practiceId, totalTasks: 3, startedAt: new Date() });
    expect(await auditProgress(db, row.id)).toMatchObject({ stage: "asking", total: 3 });
  });
});

describe("isUuid", () => {
  it("accepts a UUID and rejects anything else", () => {
    expect(isUuid("00000000-0000-4000-8000-000000000000")).toBe(true);
    expect(isUuid("nope")).toBe(false);
    expect(isUuid("../admin")).toBe(false);
  });
});
