import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { displayScores } from "@/core/scoring";
import { activities, checks, facts, findings, prompts, scans } from "@/db/schema";
import { SCAN_STUCK_AFTER_MS } from "@/services/scan-runner";

/**
 * Most recent scan of any status (running, complete, blocked, failed). Tells
 * "this week's scan didn't publish" apart from "this week's scan is last
 * week's": getLatestScan alone can't.
 */
export async function getLatestScanAttempt(db: Db, practiceId: string) {
  const [scan] = await db.select().from(scans)
    .where(eq(scans.practiceId, practiceId))
    .orderBy(desc(scans.startedAt))
    .limit(1);
  return scan ?? null;
}

/**
 * Whether a scan of the given statuses started for this practice within the
 * last `withinMs`. Guards against running two scans of one practice at once
 * (a cron delivered twice, or "Run scan" pressed mid-scan), which would
 * record the same new findings twice.
 */
export async function scanStartedWithin(
  db: Db,
  practiceId: string,
  withinMs: number,
  statuses: (typeof scans.$inferSelect.status)[] = ["running", "complete", "blocked", "failed"],
): Promise<boolean> {
  const [row] = await db.select({ id: scans.id }).from(scans).where(and(
    eq(scans.practiceId, practiceId),
    inArray(scans.status, statuses),
    gt(scans.startedAt, new Date(Date.now() - withinMs)),
  )).limit(1);
  return !!row;
}

/**
 * Whether a scan of this practice is running and still making progress. A
 * scan runs as a chain of steps that can outlast any fixed window from its
 * start, so this goes by its last progress.
 */
export async function scanInProgress(db: Db, practiceId: string): Promise<boolean> {
  const [row] = await db.select({ id: scans.id }).from(scans).where(and(
    eq(scans.practiceId, practiceId),
    eq(scans.status, "running"),
    gt(scans.updatedAt, new Date(Date.now() - SCAN_STUCK_AFTER_MS)),
  )).limit(1);
  return !!row;
}

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

/** The last `limit` published scans, oldest first, with all three scores (older scans rebuilt). */
export async function getScoreHistory(db: Db, practiceId: string, limit: number) {
  const rows = await db.select().from(scans)
    .where(and(eq(scans.practiceId, practiceId), eq(scans.status, "complete")))
    .orderBy(desc(scans.startedAt))
    .limit(limit);
  return rows.reverse().map(s => ({ date: s.startedAt, ...displayScores(s) }));
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
    namedOrder: checks.namedOrder,
    searchQueries: checks.searchQueries,
    tone: checks.tone,
    toneReason: checks.toneReason,
    run: checks.run,
    factsConfirmed: checks.factsConfirmed,
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
 * originating check's engine. The accuracy ledger groups these by status
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
    lastSeenScanId: findings.lastSeenScanId,
    createdAt: findings.createdAt,
    resolvedAt: findings.resolvedAt,
    workStartedAt: findings.workStartedAt,
    note: findings.note,
    noteUpdatedAt: findings.noteUpdatedAt,
    engine: checks.engine,
    // The pages the engine read when it made the claim: the first place to
    // look for where a wrong fact came from.
    citations: checks.citations,
    factCategory: facts.category,
    factLabel: facts.label,
  })
    .from(findings)
    .innerJoin(checks, eq(findings.checkId, checks.id))
    .leftJoin(facts, eq(findings.factId, facts.id))
    .where(eq(findings.practiceId, practiceId))
    .orderBy(desc(findings.createdAt));
}

/**
 * Most recent `limit` *client-visible* activity-log rows for a practice,
 * newest first. Internal rows (scan warnings, judge failures, password
 * issuance) are excluded: this feeds the client dashboard, and the operator
 * reads the unfiltered log on the admin practice page instead.
 */
export async function getActivities(db: Db, practiceId: string, limit: number) {
  return db.select().from(activities)
    .where(and(eq(activities.practiceId, practiceId), eq(activities.visibility, "client")))
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

/**
 * Score-band line for a scan: "Range 38-46 across 3 runs", or null for a
 * single-run scan (or one from before runs were recorded).
 */
export function describeBand(scan: { runs: number; scoreLow: number | null; scoreHigh: number | null }): string | null {
  if (scan.runs <= 1 || scan.scoreLow === null || scan.scoreHigh === null) return null;
  if (scan.scoreLow === scan.scoreHigh) return `Same score on all ${scan.runs} runs`;
  return `Range ${scan.scoreLow}-${scan.scoreHigh} across ${scan.runs} runs`;
}

/** Findings about price first, then by severity, so the most damaging reads first. */
export function priceFirst<T extends { factCategory: string | null; severity: string }>(rows: T[]): T[] {
  const rank = { critical: 0, major: 1, minor: 2 } as Record<string, number>;
  return [...rows].sort((a, b) =>
    Number(b.factCategory === "pricing") - Number(a.factCategory === "pricing") ||
    (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3));
}
