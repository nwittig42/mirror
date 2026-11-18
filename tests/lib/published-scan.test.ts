import { describe, it, expect } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import * as schema from "@/db/schema";
import { getLatestScan, getScoreHistory } from "@/lib/queries";
import { fullScanWhere, QUICK_PURPOSE } from "@/lib/published-scan";

type TestDb = Awaited<ReturnType<typeof makeTestDb>>;

async function insertScan(db: TestDb, practiceId: string, overrides: Partial<typeof schema.scans.$inferInsert> = {}) {
  const [scan] = await db.insert(schema.scans).values({
    practiceId, status: "complete", score: 50, citationRate: 50, positionScore: 50,
    breadthScore: 50, accuracyScore: 100, finishedAt: new Date(), ...overrides,
  }).returning();
  return scan;
}

describe("which complete scan is shown", () => {
  it("shows the quick scan while it is the only complete one", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Proof Bakery" });
    await insertScan(db, practiceId, { purpose: QUICK_PURPOSE, startedAt: new Date("2026-11-01T10:00:00Z") });
    expect((await getLatestScan(db, practiceId))?.purpose).toBe("quick");
  });

  it("ignores the quick scan once a full scan is complete", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Proof Bakery" });
    await insertScan(db, practiceId, { purpose: QUICK_PURPOSE, startedAt: new Date("2026-11-01T10:00:00Z") });
    const full = await insertScan(db, practiceId, { purpose: "prospect", startedAt: new Date("2026-11-01T10:02:00Z") });
    expect((await getLatestScan(db, practiceId))?.id).toBe(full.id);
    // One point of history, so the full audit has no "change" against the quick one.
    expect(await getScoreHistory(db, practiceId, 10)).toHaveLength(1);
  });

  it("ignores a quick scan that is newer than the full one", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Proof Bakery" });
    const full = await insertScan(db, practiceId, { purpose: "prospect", startedAt: new Date("2026-11-01T10:00:00Z") });
    await insertScan(db, practiceId, { purpose: QUICK_PURPOSE, startedAt: new Date("2026-11-01T10:05:00Z") });
    expect((await getLatestScan(db, practiceId))?.id).toBe(full.id);
  });

  it("keeps showing the quick scan when the full one is blocked", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Proof Bakery" });
    const quick = await insertScan(db, practiceId, { purpose: QUICK_PURPOSE, startedAt: new Date("2026-11-01T10:00:00Z") });
    await insertScan(db, practiceId, { purpose: "prospect", status: "blocked", score: null, startedAt: new Date("2026-11-01T10:02:00Z") });
    expect((await getLatestScan(db, practiceId))?.id).toBe(quick.id);
  });

  it("never gives a quick scan to the report", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Proof Bakery" });
    await insertScan(db, practiceId, { purpose: QUICK_PURPOSE });
    expect(await db.select().from(schema.scans).where(fullScanWhere(practiceId))).toHaveLength(0);
    const full = await insertScan(db, practiceId, { purpose: "weekly" });
    const rows = await db.select().from(schema.scans).where(fullScanWhere(practiceId));
    expect(rows.map(r => r.id)).toEqual([full.id]);
  });
});
