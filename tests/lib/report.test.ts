import { describe, it, expect } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import * as schema from "@/db/schema";
import { buildReportData, resolveMonthParam } from "@/lib/report";

function currentMonthISO(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

describe("resolveMonthParam", () => {
  it("falls back to the current UTC month when the param is missing", () =>
    expect(resolveMonthParam(undefined)).toBe(currentMonthISO()));

  it("passes through a valid YYYY-MM value", () =>
    expect(resolveMonthParam("2026-07")).toBe("2026-07"));

  it("falls back to the current UTC month for non-matching garbage", () =>
    expect(resolveMonthParam("garbage")).toBe(currentMonthISO()));

  it("falls back to the current UTC month when the month is missing", () =>
    expect(resolveMonthParam("2026")).toBe(currentMonthISO()));

  it("falls back to the current UTC month for an out-of-range month", () =>
    expect(resolveMonthParam("2026-13")).toBe(currentMonthISO()));

  it("falls back to the current UTC month for a zero month", () =>
    expect(resolveMonthParam("2026-00")).toBe(currentMonthISO()));
});

type TestDb = Awaited<ReturnType<typeof makeTestDb>>;

async function insertScan(db: TestDb, practiceId: string, startedAt: Date, score: number) {
  const [scan] = await db.insert(schema.scans).values({
    practiceId, status: "complete", score, citationRate: score, positionScore: score,
    breadthScore: score, accuracyScore: 100, startedAt, finishedAt: startedAt,
  }).returning();
  return scan;
}

async function insertCheck(
  db: TestDb, scanId: string, promptId: string,
  overrides: Partial<typeof schema.checks.$inferInsert> = {},
) {
  const [check] = await db.insert(schema.checks).values({
    scanId, promptId, engine: "openai", answerText: "Some answer.", mentioned: false, position: "absent",
    ...overrides,
  }).returning();
  return check;
}

describe("buildReportData", () => {
  it("computes per-engine cited/total across two scans in the month", async () => {
    const db = await makeTestDb();
    const { practiceId, promptIds } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best medspa near me?", kind: "category" }],
    });
    const promptId = promptIds[0];

    const scan1 = await insertScan(db, practiceId, new Date("2026-07-05T12:00:00Z"), 40);
    await insertCheck(db, scan1.id, promptId, { engine: "openai", mentioned: true, position: "first" });
    await insertCheck(db, scan1.id, promptId, { engine: "anthropic", mentioned: false, position: "absent" });

    const scan2 = await insertScan(db, practiceId, new Date("2026-07-20T12:00:00Z"), 60);
    await insertCheck(db, scan2.id, promptId, { engine: "openai", mentioned: true, position: "top3" });
    await insertCheck(db, scan2.id, promptId, { engine: "anthropic", mentioned: true, position: "mentioned" });

    const report = await buildReportData(db, practiceId, "2026-07");

    expect(report.perEngine).toEqual(expect.arrayContaining([
      { engine: "ChatGPT", cited: 2, total: 2 },
      { engine: "Claude", cited: 1, total: 2 },
      { engine: "Gemini", cited: 0, total: 0 },
      { engine: "Perplexity", cited: 0, total: 0 },
    ]));
    expect(report.score).toBe(60);
    expect(report.trend).toEqual([
      { date: scan1.startedAt.toISOString(), score: 40 },
      { date: scan2.startedAt.toISOString(), score: 60 },
    ]);
  });

  it("counts the accuracy ledger by status and in-month date", async () => {
    const db = await makeTestDb();
    const { practiceId, promptIds } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best medspa near me?", kind: "category" }],
    });
    const scan = await insertScan(db, practiceId, new Date("2026-07-10T12:00:00Z"), 50);
    const check = await insertCheck(db, scan.id, promptIds[0]);

    // found + still open, created in-month
    await db.insert(schema.findings).values({
      practiceId, checkId: check.id, claim: "Open issue", severity: "minor", status: "open",
      createdAt: new Date("2026-07-02T00:00:00Z"),
    });
    // found + fixed in-month
    await db.insert(schema.findings).values({
      practiceId, checkId: check.id, claim: "Fixed issue", severity: "major", status: "fixed",
      createdAt: new Date("2026-07-03T00:00:00Z"), resolvedAt: new Date("2026-07-15T00:00:00Z"),
    });
    // created last month, verified in-month: not "found" this month, but "verified" this month
    await db.insert(schema.findings).values({
      practiceId, checkId: check.id, claim: "Verified issue", severity: "critical", status: "verified",
      createdAt: new Date("2026-06-20T00:00:00Z"), resolvedAt: new Date("2026-07-18T00:00:00Z"),
    });
    // open issue from a previous month: counts toward "open" (any age) but not "found"
    await db.insert(schema.findings).values({
      practiceId, checkId: check.id, claim: "Old open issue", severity: "minor", status: "open",
      createdAt: new Date("2026-05-01T00:00:00Z"),
    });

    const report = await buildReportData(db, practiceId, "2026-07");

    expect(report.accuracyLedger).toEqual({ found: 2, fixed: 1, verified: 1, open: 2 });
  });

  it("verdict includes the comparison clause when a prior month exists", async () => {
    const db = await makeTestDb();
    const { practiceId, promptIds } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best medspa near me?", kind: "category" }],
    });
    const promptId = promptIds[0];

    const juneScan = await insertScan(db, practiceId, new Date("2026-06-10T12:00:00Z"), 30);
    await insertCheck(db, juneScan.id, promptId, { mentioned: true }); // 1/2 => 50%
    await insertCheck(db, juneScan.id, promptId, { mentioned: false });

    const julyScan = await insertScan(db, practiceId, new Date("2026-07-10T12:00:00Z"), 70);
    await insertCheck(db, julyScan.id, promptId, { mentioned: true }); // 3/4 => 75%
    await insertCheck(db, julyScan.id, promptId, { mentioned: true });
    await insertCheck(db, julyScan.id, promptId, { mentioned: true });
    await insertCheck(db, julyScan.id, promptId, { mentioned: false });

    const report = await buildReportData(db, practiceId, "2026-07");

    expect(report.verdict).toBe(
      "AI engines named Glow MedSpa in 75% of patient-question checks in July 2026, up from 50% last month.",
    );
    expect(report.prevMonthScore).toBe(30);
  });

  it("verdict omits the comparison clause when there is no prior month", async () => {
    const db = await makeTestDb();
    const { practiceId, promptIds } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best medspa near me?", kind: "category" }],
    });
    const promptId = promptIds[0];

    const scan = await insertScan(db, practiceId, new Date("2026-07-10T12:00:00Z"), 50);
    await insertCheck(db, scan.id, promptId, { mentioned: true });
    await insertCheck(db, scan.id, promptId, { mentioned: false });

    const report = await buildReportData(db, practiceId, "2026-07");

    expect(report.verdict).toBe(
      "AI engines named Glow MedSpa in 50% of patient-question checks in July 2026.",
    );
    expect(report.prevMonthScore).toBeNull();
  });

  it("degrades gracefully with no in-month scans", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });

    const report = await buildReportData(db, practiceId, "2026-07");

    expect(report.score).toBeNull();
    expect(report.trend).toEqual([]);
    expect(report.bestQuote).toBeNull();
    expect(report.accuracyLedger).toEqual({ found: 0, fixed: 0, verified: 0, open: 0 });
    expect(report.verdict).toBe("No AI-visibility checks were run for Glow MedSpa in July 2026.");
  });

  it("extracts the best quote from the latest in-month scan's mentioned checks", async () => {
    const db = await makeTestDb();
    const { practiceId, promptIds } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best medspa near me?", kind: "category" }],
    });
    const scan = await insertScan(db, practiceId, new Date("2026-07-10T12:00:00Z"), 50);
    await insertCheck(db, scan.id, promptIds[0], {
      engine: "perplexity", mentioned: true, position: "first",
      answerText: "There are several options. Glow MedSpa is known for natural results. Book online.",
    });

    const report = await buildReportData(db, practiceId, "2026-07");

    expect(report.bestQuote).toEqual({
      engine: "Perplexity",
      prompt: "Best medspa near me?",
      snippet: "Glow MedSpa is known for natural results",
    });
  });

  it("caps activities to 30, newest first, scoped to the month", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });

    await db.insert(schema.activities).values({
      practiceId, description: "Out of month", createdAt: new Date("2026-06-15T00:00:00Z"),
    });
    await db.insert(schema.activities).values({
      practiceId, description: "Early July", createdAt: new Date("2026-07-01T00:00:00Z"),
    });
    await db.insert(schema.activities).values({
      practiceId, description: "Late July", createdAt: new Date("2026-07-25T00:00:00Z"),
    });

    const report = await buildReportData(db, practiceId, "2026-07");

    expect(report.activities).toEqual(["Late July", "Early July"]);
  });
});
