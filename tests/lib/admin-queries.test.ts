import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import * as schema from "@/db/schema";
import {
  listPracticeRows, getScanHistory, getPracticeLogins, getSupportForPractice, getWorkLog,
} from "@/lib/admin-queries";

type Db = Awaited<ReturnType<typeof makeTestDb>>;
const scan = (db: Db, practiceId: string, v: Partial<typeof schema.scans.$inferInsert>) =>
  db.insert(schema.scans).values({ practiceId, ...v }).returning().then(r => r[0]);

describe("listPracticeRows", () => {
  it("gives each practice its latest published score and its newest scan attempt", async () => {
    const db = await makeTestDb();
    const { practiceId: a } = await seedPractice(db, { name: "Glow MedSpa" });
    const { practiceId: b } = await seedPractice(db, { name: "Skin Bar LA" });
    await scan(db, a, { status: "complete", score: 61, startedAt: new Date("2026-09-01") });
    await scan(db, a, { status: "complete", score: 72, visibilityScore: 66, factScore: 88, startedAt: new Date("2026-09-08") });
    await scan(db, a, { status: "blocked", startedAt: new Date("2026-09-15") });
    const rows = await listPracticeRows(db);
    const glow = rows.find(r => r.id === a)!;
    expect(glow).toMatchObject({ overall: 72, visibility: 66, facts: 88 });
    expect(glow.lastScanStatus).toBe("blocked");
    expect(glow.lastScanAt?.toISOString().slice(0, 10)).toBe("2026-09-15");
    const skin = rows.find(r => r.id === b)!;
    expect(skin).toMatchObject({ overall: null, lastScanAt: null, lastScanStatus: null });
  });
});

describe("getScanHistory", () => {
  it("lists every scan, any status, newest first, for this practice only", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    const { practiceId: other } = await seedPractice(db, { name: "Other" });
    await scan(db, practiceId, { status: "complete", score: 60, startedAt: new Date("2026-09-01") });
    await scan(db, practiceId, { status: "failed", startedAt: new Date("2026-09-08") });
    await scan(db, other, { status: "complete", startedAt: new Date("2026-09-09") });
    const rows = await getScanHistory(db, practiceId);
    expect(rows.map(r => r.status)).toEqual(["failed", "complete"]);
  });
});

describe("getPracticeLogins", () => {
  it("lists the customer's logins with the temporary-password flag", async () => {
    const db = await makeTestDb();
    const { practiceId, memberIds } = await seedPractice(db, { name: "Glow MedSpa", members: ["a@glow.example", "b@glow.example"] });
    await db.update(schema.users).set({ mustChangePassword: true }).where(eq(schema.users.id, memberIds[0]));
    const rows = await getPracticeLogins(db, practiceId);
    expect(rows.map(r => [r.email, r.mustChangePassword]).sort()).toEqual([["a@glow.example", true], ["b@glow.example", false]]);
  });
});

describe("getSupportForPractice and getWorkLog", () => {
  it("scope to the practice and split the log by who can see it", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    const { practiceId: other } = await seedPractice(db, { name: "Other" });
    await db.insert(schema.supportRequests).values([
      { practiceId, email: "a@glow.example", topic: "report", message: "Where's my report?" },
      { practiceId: other, email: "x@o.example", topic: "report", message: "nope" },
    ]);
    await db.insert(schema.activities).values([
      { practiceId, description: "Fixed Yelp listing", visibility: "client" },
      { practiceId, description: "scan warning: gemini failed", visibility: "internal" },
    ]);
    expect((await getSupportForPractice(db, practiceId)).map(r => r.message)).toEqual(["Where's my report?"]);
    expect((await getWorkLog(db, practiceId, "client")).map(r => r.description)).toEqual(["Fixed Yelp listing"]);
    expect((await getWorkLog(db, practiceId, "internal")).map(r => r.description)).toEqual(["scan warning: gemini failed"]);
  });
});

describe("getScoreHistory and scoreTrend", () => {
  it("lists published scans oldest first with all three scores, and compares the last two", async () => {
    const { getScoreHistory } = await import("@/lib/queries");
    const { scoreTrend } = await import("@/core/scoring");
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Glow MedSpa" });
    await scan(db, practiceId, { status: "complete", score: 50, visibilityScore: 40, factScore: 80, startedAt: new Date("2026-09-01") });
    await scan(db, practiceId, { status: "blocked", startedAt: new Date("2026-09-05") });
    await scan(db, practiceId, { status: "complete", score: 58, visibilityScore: 50, factScore: 76, startedAt: new Date("2026-09-08") });
    const h = await getScoreHistory(db, practiceId, 12);
    expect(h.map(p => p.overall)).toEqual([50, 58]);
    expect(scoreTrend(h, "overall")).toEqual({ now: 58, change: 8 });
    expect(scoreTrend(h, "facts")).toEqual({ now: 76, change: -4 });
    expect(scoreTrend(h.slice(0, 1), "visibility")).toEqual({ now: 40, change: null });
  });
});
