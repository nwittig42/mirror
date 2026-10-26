import { describe, it, expect } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import * as schema from "@/db/schema";
import { buildReportData, resolveMonthParam, reviewChanges } from "@/lib/report";

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
  it("leaves branded checks out of the citation numbers the client reads", async () => {
    // A branded prompt names the practice in the question, so the answer names
    // it back every time. Counting those would report a practice that never
    // surfaces in its niche as being cited most of the time.
    const db = await makeTestDb();
    const { practiceId, promptIds } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [
        { text: "Best med spa in Santa Monica?", kind: "category" },
        { text: "How much does Botox cost at Glow MedSpa?", kind: "branded" },
      ],
    });
    const [categoryPrompt, brandedPrompt] = promptIds;

    const scan = await insertScan(db, practiceId, new Date("2026-07-05T12:00:00Z"), 40);
    await insertCheck(db, scan.id, categoryPrompt, { engine: "openai", mentioned: false, position: "absent" });
    await insertCheck(db, scan.id, brandedPrompt, { engine: "openai", mentioned: true, position: "first" });

    const report = await buildReportData(db, practiceId, "2026-07");

    expect(report.perEngine).toEqual(expect.arrayContaining([
      { engine: "ChatGPT", cited: 0, total: 1 },
    ]));
    expect(report.citationPct).toBe(0);
  });

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
    // As shown, on the 30-100 scale (raw 40 and 60).
    expect(report.score).toBe(72);
    expect(report.trend).toEqual([
      { date: scan1.startedAt.toISOString(), score: 58 },
      { date: scan2.startedAt.toISOString(), score: 72 },
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
      "AI engines named Glow MedSpa in 75% of answers to questions that didn't name them, in July 2026, up from 50% last month.",
    );
    expect(report.prevMonthScore).toBe(51); // raw 30, as shown
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
      "AI engines named Glow MedSpa in 50% of answers to questions that didn't name them, in July 2026.",
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

  // Review finding #17: a counted list mention gets its snippet. Without
  // the row's competitors, "Glow MedSpa and Skin Bar LA" is one longer name
  // to the matcher and the quote is skipped.
  it("quotes a list answer that joins the business to a competitor by 'and'", async () => {
    const db = await makeTestDb();
    const { practiceId, promptIds } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best medspa near me?", kind: "category" }],
    });
    const scan = await insertScan(db, practiceId, new Date("2026-07-10T12:00:00Z"), 50);
    await insertCheck(db, scan.id, promptIds[0], {
      engine: "perplexity", mentioned: true, position: "first",
      answerText: "Glow MedSpa and Skin Bar LA are both good. Book online.",
      competitorsMentioned: ["Skin Bar LA"], namedOrder: ["Glow MedSpa", "Skin Bar LA"],
    });

    const report = await buildReportData(db, practiceId, "2026-07");

    expect(report.bestQuote).toEqual({
      engine: "Perplexity",
      prompt: "Best medspa near me?",
      snippet: "Glow MedSpa and Skin Bar LA are both good",
    });
  });

  it("caps activities to 30, newest first, scoped to the month", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });

    await db.insert(schema.activities).values({
      practiceId, description: "Out of month", visibility: "client",
      createdAt: new Date("2026-06-15T00:00:00Z"),
    });
    await db.insert(schema.activities).values({
      practiceId, description: "Early July", visibility: "client",
      createdAt: new Date("2026-07-01T00:00:00Z"),
    });
    await db.insert(schema.activities).values({
      practiceId, description: "Late July", visibility: "client",
      createdAt: new Date("2026-07-25T00:00:00Z"),
    });

    const report = await buildReportData(db, practiceId, "2026-07");

    expect(report.activities).toEqual(["Late July", "Early July"]);
  });

  it("leaves internal activities out of the client's report", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });

    await db.insert(schema.activities).values({
      practiceId, description: "Claimed the Bing Places listing", visibility: "client",
      createdAt: new Date("2026-07-10T00:00:00Z"),
    });
    await db.insert(schema.activities).values({
      practiceId, description: "scan warning: gemini failed on prompt X", visibility: "internal",
      createdAt: new Date("2026-07-11T00:00:00Z"),
    });

    const report = await buildReportData(db, practiceId, "2026-07");

    expect(report.activities).toEqual(["Claimed the Bing Places listing"]);
  });
});

describe("the month-by-month history and the review", () => {
  it("gives one point per month for six months, from each month's last scan, and compares the last two", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa", slug: "glow-history" });
    await insertScan(db, practiceId, new Date(Date.UTC(2026, 4, 10)), 20);
    await insertScan(db, practiceId, new Date(Date.UTC(2026, 5, 3)), 25);
    await insertScan(db, practiceId, new Date(Date.UTC(2026, 5, 24)), 31);
    await insertScan(db, practiceId, new Date(Date.UTC(2026, 6, 8)), 28);

    const r = await buildReportData(db, practiceId, "2026-07");
    expect(r.months.map(m => m.month)).toEqual(["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"]);
    expect(r.months.map(m => m.label)).toEqual(["Feb", "Mar", "Apr", "May", "Jun", "Jul"]);
    // Raw 20, 31 and 28, as shown.
    expect(r.months.map(m => m.overall)).toEqual([null, null, null, 44, 52, 50]);
    const overall = r.changes.find(c => c.key === "overall")!;
    expect([overall.before, overall.now]).toEqual([52, 50]);
    expect(r.comparedTo).toBe("Jun");
  });

  it("compares with the last month that had a scan when the month before had none", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa", slug: "glow-gap" });
    await insertScan(db, practiceId, new Date(Date.UTC(2026, 4, 10)), 35);
    await insertScan(db, practiceId, new Date(Date.UTC(2026, 6, 8)), 8);

    const r = await buildReportData(db, practiceId, "2026-07");
    const overall = r.changes.find(c => c.key === "overall")!;
    expect([overall.before, overall.now, r.comparedTo]).toEqual([55, 36, "May"]); // raw 35 and 8
    // The share of answers is only compared with the month right before.
    expect(r.changes.find(c => c.key === "named")!.before).toBeNull();

    const first = await buildReportData(db, practiceId, "2026-05");
    expect(first.comparedTo).toBeNull();
    expect(first.changes.every(c => c.before === null)).toBe(true);
  });

  it("sorts changes into improved, worse and held, and skips what can't be compared", () => {
    const review = reviewChanges([
      { key: "overall", label: "Overall", now: 28, before: 31, unit: "" },
      { key: "visibility", label: "Recommended by AI", now: 40, before: 35, unit: "" },
      { key: "facts", label: "Accuracy", now: null, before: 70, unit: "" },
      { key: "named", label: "Answers that named you", now: 12, before: 12, unit: "%" },
    ]);
    expect(review.improved).toEqual(["Recommended by AI rose from 35 to 40"]);
    expect(review.worse).toEqual(["Overall fell from 31 to 28"]);
    expect(review.same).toEqual(["Answers that named you held at 12%"]);
  });
});
