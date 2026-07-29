import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { activities, checks, findings, prompts, scans } from "@/db/schema";

/** Most recent COMPLETE scan for a practice, or null if none has finished yet. */
export async function getLatestScan(db: Db, practiceId: string) {
  const [scan] = await db.select().from(scans)
    .where(and(eq(scans.practiceId, practiceId), eq(scans.status, "complete")))
    .orderBy(desc(scans.startedAt))
    .limit(1);
  return scan ?? null;
}

/**
 * Completed scans only, oldest to newest, capped to the `weeks` most recent
 * (i.e. if there are more completed scans than `weeks`, the oldest ones are
 * dropped, not the most recent).
 */
export async function getScoreTrend(
  db: Db, practiceId: string, weeks: number,
): Promise<{ date: string; score: number }[]> {
  const rows = await db.select().from(scans)
    .where(and(eq(scans.practiceId, practiceId), eq(scans.status, "complete")))
    .orderBy(desc(scans.startedAt))
    .limit(weeks);

  return rows
    .reverse()
    .map(s => ({ date: s.startedAt.toISOString(), score: s.score ?? 0 }));
}

/** Every check from a scan, joined with its prompt's text and kind, oldest first. */
export async function getChecksForScan(db: Db, scanId: string) {
  return db.select({
    id: checks.id,
    scanId: checks.scanId,
    promptId: checks.promptId,
    engine: checks.engine,
    answerText: checks.answerText,
    citations: checks.citations,
    mentioned: checks.mentioned,
    position: checks.position,
    competitorsMentioned: checks.competitorsMentioned,
    createdAt: checks.createdAt,
    promptText: prompts.text,
    promptKind: prompts.kind,
  })
    .from(checks)
    .innerJoin(prompts, eq(checks.promptId, prompts.id))
    .where(eq(checks.scanId, scanId))
    .orderBy(asc(checks.createdAt));
}

/** Open (unresolved) findings for a practice, most recent first. */
export async function getOpenFindings(db: Db, practiceId: string) {
  return db.select().from(findings)
    .where(and(eq(findings.practiceId, practiceId), eq(findings.status, "open")))
    .orderBy(desc(findings.createdAt));
}

/**
 * Every finding for a practice regardless of status, joined with the
 * originating check's engine — the accuracy ledger groups these by status
 * client-side (open/fixed/verified/dismissed).
 */
export async function getFindingsForPractice(db: Db, practiceId: string) {
  return db.select({
    id: findings.id,
    checkId: findings.checkId,
    factId: findings.factId,
    claim: findings.claim,
    factValue: findings.factValue,
    severity: findings.severity,
    status: findings.status,
    createdAt: findings.createdAt,
    resolvedAt: findings.resolvedAt,
    engine: checks.engine,
  })
    .from(findings)
    .innerJoin(checks, eq(findings.checkId, checks.id))
    .where(eq(findings.practiceId, practiceId))
    .orderBy(desc(findings.createdAt));
}

/** Most recent `limit` activity-log rows for a practice, newest first. */
export async function getActivities(db: Db, practiceId: string, limit: number) {
  return db.select().from(activities)
    .where(eq(activities.practiceId, practiceId))
    .orderBy(desc(activities.createdAt))
    .limit(limit);
}

/**
 * Tallies `competitorsMentioned` across every check in a scan into a
 * per-competitor mention count, descending (ties broken alphabetically for a
 * stable order).
 */
export async function getCompetitorPressure(
  db: Db, scanId: string,
): Promise<{ name: string; mentions: number }[]> {
  const rows = await db.select({ competitorsMentioned: checks.competitorsMentioned })
    .from(checks)
    .where(eq(checks.scanId, scanId));

  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const name of row.competitorsMentioned) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([name, mentions]) => ({ name, mentions }))
    .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name));
}
