import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { activities, practiceMembers, practices, scans, supportRequests, users } from "@/db/schema";
import { displayScores } from "@/core/scoring";

/**
 * Reads behind the operator's customer views (`/admin` and the customer
 * overview). Operator-only callers; nothing here is scoped by session.
 */

/**
 * Every practice with its latest *published* score (newest complete scan) and
 * its newest scan attempt of any status, so the list shows both "what the
 * customer sees" and "what happened last".
 */
export async function listPracticeRows(db: Db) {
  const [practiceRows, scanRows] = await Promise.all([
    db.select().from(practices).orderBy(desc(practices.createdAt)),
    db.select({
      practiceId: scans.practiceId, status: scans.status, score: scans.score, startedAt: scans.startedAt,
      visibilityScore: scans.visibilityScore, factScore: scans.factScore,
      citationRate: scans.citationRate, positionScore: scans.positionScore, breadthScore: scans.breadthScore,
      accuracyScore: scans.accuracyScore,
    }).from(scans).orderBy(desc(scans.startedAt)),
  ]);
  return practiceRows.map(p => {
    const own = scanRows.filter(s => s.practiceId === p.id);
    const published = own.find(s => s.status === "complete");
    return {
      id: p.id, name: p.name, slug: p.slug, website: p.website, active: p.active,
      ...(published ? displayScores(published) : { overall: null, visibility: null, facts: null, estimated: false }),
      lastScanAt: own[0]?.startedAt ?? null,
      lastScanStatus: own[0]?.status ?? null,
    };
  });
}

/** Every scan for a practice, any status, newest first. */
export async function getScanHistory(db: Db, practiceId: string, limit = 100) {
  return db.select({
    id: scans.id, status: scans.status, startedAt: scans.startedAt, finishedAt: scans.finishedAt,
    score: scans.score, visibilityScore: scans.visibilityScore, factScore: scans.factScore,
    citationRate: scans.citationRate, positionScore: scans.positionScore, breadthScore: scans.breadthScore,
    accuracyScore: scans.accuracyScore, coverage: scans.coverage, runs: scans.runs,
  }).from(scans)
    .where(eq(scans.practiceId, practiceId))
    .orderBy(desc(scans.startedAt))
    .limit(limit);
}

/** The customer's login accounts. Last login isn't recorded (JWT sessions). */
export async function getPracticeLogins(db: Db, practiceId: string) {
  return db.select({
    id: users.id, email: users.email, name: users.name,
    mustChangePassword: users.mustChangePassword, hasPassword: users.passwordHash, createdAt: users.createdAt,
  }).from(practiceMembers)
    .innerJoin(users, eq(practiceMembers.userId, users.id))
    .where(eq(practiceMembers.practiceId, practiceId))
    .orderBy(users.email)
    .then(rows => rows.map(({ hasPassword, ...r }) => ({ ...r, hasPassword: !!hasPassword })));
}

export async function getSupportForPractice(db: Db, practiceId: string) {
  return db.select().from(supportRequests)
    .where(eq(supportRequests.practiceId, practiceId))
    .orderBy(desc(supportRequests.createdAt));
}

/** The work log the customer sees ("client") or the operator's diagnostics ("internal"). */
export async function getWorkLog(db: Db, practiceId: string, visibility: "client" | "internal", limit = 50) {
  return db.select().from(activities)
    .where(and(eq(activities.practiceId, practiceId), eq(activities.visibility, visibility)))
    .orderBy(desc(activities.createdAt))
    .limit(limit);
}
