import { describe, it, expect } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import * as schema from "@/db/schema";
import {
  getLatestScan, getScoreTrend, getChecksForScan, getOpenFindings,
  getFindingsForPractice, getActivities, getCompetitorPressure,
} from "@/lib/queries";

async function insertScan(
  db: Awaited<ReturnType<typeof makeTestDb>>,
  practiceId: string,
  overrides: Partial<typeof schema.scans.$inferInsert> = {},
) {
  const [scan] = await db.insert(schema.scans).values({
    practiceId,
    status: "complete",
    score: 50,
    citationRate: 50,
    positionScore: 50,
    breadthScore: 50,
    accuracyScore: 100,
    finishedAt: new Date(),
    ...overrides,
  }).returning();
  return scan;
}

describe("getLatestScan", () => {
  it("returns null when there are no completed scans", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    await insertScan(db, practiceId, { status: "running", score: null, startedAt: new Date("2026-01-01") });
    expect(await getLatestScan(db, practiceId)).toBeNull();
  });

  it("returns the most recent completed scan, ignoring running/failed ones", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    await insertScan(db, practiceId, { score: 40, startedAt: new Date("2026-01-01") });
    const latest = await insertScan(db, practiceId, { score: 55, startedAt: new Date("2026-01-15") });
    await insertScan(db, practiceId, { status: "failed", score: null, startedAt: new Date("2026-01-20") });

    const result = await getLatestScan(db, practiceId);
    expect(result?.id).toBe(latest.id);
    expect(result?.score).toBe(55);
  });
});

describe("getScoreTrend", () => {
  it("returns only completed scans, ascending by date", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    await insertScan(db, practiceId, { score: 30, startedAt: new Date("2026-01-15") });
    await insertScan(db, practiceId, { score: 10, startedAt: new Date("2026-01-01") });
    await insertScan(db, practiceId, { status: "running", score: null, startedAt: new Date("2026-01-20") });
    await insertScan(db, practiceId, { score: 20, startedAt: new Date("2026-01-08") });

    const trend = await getScoreTrend(db, practiceId, 10);
    expect(trend).toEqual([
      { date: new Date("2026-01-01").toISOString(), score: 10 },
      { date: new Date("2026-01-08").toISOString(), score: 20 },
      { date: new Date("2026-01-15").toISOString(), score: 30 },
    ]);
  });

  it("caps to the N most recent completed scans, dropping the oldest", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    await insertScan(db, practiceId, { score: 10, startedAt: new Date("2026-01-01") });
    await insertScan(db, practiceId, { score: 20, startedAt: new Date("2026-01-08") });
    await insertScan(db, practiceId, { score: 30, startedAt: new Date("2026-01-15") });

    const trend = await getScoreTrend(db, practiceId, 2);
    expect(trend.map(t => t.score)).toEqual([20, 30]);
  });

  it("returns an empty array when no scan has completed", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    await insertScan(db, practiceId, { status: "running", score: null });
    expect(await getScoreTrend(db, practiceId, 12)).toEqual([]);
  });
});

describe("getChecksForScan", () => {
  it("joins checks with their prompt text and kind", async () => {
    const db = await makeTestDb();
    const { practiceId, promptIds } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa in Santa Monica", kind: "category" }],
    });
    const scan = await insertScan(db, practiceId);
    await db.insert(schema.checks).values({
      scanId: scan.id,
      promptId: promptIds[0],
      engine: "openai",
      answerText: "Glow MedSpa is great.",
      citations: ["https://x.example"],
      mentioned: true,
      position: "first",
      competitorsMentioned: [],
    });

    const result = await getChecksForScan(db, scan.id);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      engine: "openai",
      answerText: "Glow MedSpa is great.",
      promptText: "Best med spa in Santa Monica",
      promptKind: "category",
    });
  });
});

describe("getOpenFindings", () => {
  it("returns only open findings for the practice", async () => {
    const db = await makeTestDb();
    const { practiceId, promptIds } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "How much is Botox?", kind: "branded" }],
    });
    const scan = await insertScan(db, practiceId);
    const [check] = await db.insert(schema.checks).values({
      scanId: scan.id, promptId: promptIds[0], engine: "openai",
      answerText: "Botox is $9/unit.", citations: [], mentioned: true, position: "first", competitorsMentioned: [],
    }).returning();

    await db.insert(schema.findings).values([
      { practiceId, checkId: check.id, claim: "Botox is $9/unit", severity: "major", status: "open" },
      { practiceId, checkId: check.id, claim: "Old claim", severity: "minor", status: "fixed" },
    ]);

    const open = await getOpenFindings(db, practiceId);
    expect(open).toHaveLength(1);
    expect(open[0].claim).toBe("Botox is $9/unit");
  });
});

describe("getFindingsForPractice", () => {
  it("returns findings across all statuses joined with the check's engine", async () => {
    const db = await makeTestDb();
    const { practiceId, promptIds } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "How much is Botox?", kind: "branded" }],
    });
    const scan = await insertScan(db, practiceId);
    const [check] = await db.insert(schema.checks).values({
      scanId: scan.id, promptId: promptIds[0], engine: "anthropic",
      answerText: "Botox is $9/unit.", citations: [], mentioned: true, position: "first", competitorsMentioned: [],
    }).returning();

    await db.insert(schema.findings).values([
      { practiceId, checkId: check.id, claim: "Open claim", severity: "major", status: "open" },
      { practiceId, checkId: check.id, claim: "Fixed claim", severity: "minor", status: "fixed" },
    ]);

    const all = await getFindingsForPractice(db, practiceId);
    expect(all).toHaveLength(2);
    expect(all.every(f => f.engine === "anthropic")).toBe(true);
    expect(all.map(f => f.status).sort()).toEqual(["fixed", "open"]);
  });
});

describe("getActivities", () => {
  it("returns the most recent N activities, newest first", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    await db.insert(schema.activities).values([
      { practiceId, description: "first", createdAt: new Date("2026-01-01") },
      { practiceId, description: "second", createdAt: new Date("2026-01-02") },
      { practiceId, description: "third", createdAt: new Date("2026-01-03") },
    ]);

    const result = await getActivities(db, practiceId, 2);
    expect(result.map(a => a.description)).toEqual(["third", "second"]);
  });
});

describe("getCompetitorPressure", () => {
  it("counts competitor mentions across a scan's checks, descending", async () => {
    const db = await makeTestDb();
    const { practiceId, promptIds } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa", kind: "category" }],
      competitors: ["Skin Bar LA", "Derm House"],
    });
    const scan = await insertScan(db, practiceId);
    await db.insert(schema.checks).values([
      {
        scanId: scan.id, promptId: promptIds[0], engine: "openai",
        answerText: "Skin Bar LA and Derm House are options.", citations: [], mentioned: false, position: "absent",
        competitorsMentioned: ["Skin Bar LA", "Derm House"],
      },
      {
        scanId: scan.id, promptId: promptIds[0], engine: "anthropic",
        answerText: "Skin Bar LA is popular.", citations: [], mentioned: false, position: "absent",
        competitorsMentioned: ["Skin Bar LA"],
      },
      {
        scanId: scan.id, promptId: promptIds[0], engine: "gemini",
        answerText: "Glow MedSpa is great.", citations: [], mentioned: true, position: "first",
        competitorsMentioned: [],
      },
    ]);

    const pressure = await getCompetitorPressure(db, scan.id);
    expect(pressure).toEqual([
      { name: "Skin Bar LA", mentions: 2 },
      { name: "Derm House", mentions: 1 },
    ]);
  });

  it("returns an empty array when no check mentions a competitor", async () => {
    const db = await makeTestDb();
    const { practiceId, promptIds } = await seedPractice(db, {
      name: "Glow MedSpa",
      prompts: [{ text: "Best med spa", kind: "category" }],
    });
    const scan = await insertScan(db, practiceId);
    await db.insert(schema.checks).values({
      scanId: scan.id, promptId: promptIds[0], engine: "openai",
      answerText: "Glow MedSpa is great.", citations: [], mentioned: true, position: "first", competitorsMentioned: [],
    });

    expect(await getCompetitorPressure(db, scan.id)).toEqual([]);
  });
});
