import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import type { Db } from "@/db";
import { activities, checks, findings, nameVariations, practices, scans } from "@/db/schema";
import { getChecksForScan } from "@/lib/queries";
import { extractSnippet } from "@/core/mention";
import { ENGINES, ENGINE_LABELS } from "@/core/types";

export interface ReportData {
  verdict: string;
  score: number | null;
  prevMonthScore: number | null;
  trend: { date: string; score: number }[];
  perEngine: { engine: string; cited: number; total: number }[];
  accuracyLedger: { found: number; fixed: number; verified: number; open: number };
  activities: string[];
  bestQuote: { engine: string; prompt: string; snippet: string } | null;
}

const ACTIVITY_CAP = 30;

/** [start, end) UTC bounds for a calendar month, plus the same for the preceding month. */
function monthBounds(monthISO: string): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const [yearStr, monthStr] = monthISO.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-indexed
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const prevStart = new Date(Date.UTC(year, month - 2, 1));
  return { start, end, prevStart, prevEnd: start };
}

/** English "Month YYYY" label for a "YYYY-MM" ISO month string, e.g. "2026-07" -> "July 2026". */
export function formatMonthLabel(monthISO: string): string {
  const { start } = monthBounds(monthISO);
  return start.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function inRange(d: Date, start: Date, end: Date): boolean {
  return d >= start && d < end;
}

/** All checks belonging to any of `scanIds` — skips the query (and an invalid empty `IN ()`) when there are none. */
async function checksForScans(db: Db, scanIds: string[]): Promise<(typeof checks.$inferSelect)[]> {
  if (scanIds.length === 0) return [];
  return db.select().from(checks).where(inArray(checks.scanId, scanIds));
}

/**
 * Builds every number the printable monthly client report needs, scoped to
 * completed scans whose `startedAt` falls within the given calendar month
 * (UTC). Every field is traceable to stored checks/findings/activities — no
 * estimates. Degrades gracefully (nulls/empty arrays/zero counts) when a
 * practice has no completed scans in the requested month.
 */
export async function buildReportData(db: Db, practiceId: string, monthISO: string): Promise<ReportData> {
  const { start, end, prevStart, prevEnd } = monthBounds(monthISO);

  const [practice] = await db.select().from(practices).where(eq(practices.id, practiceId));
  const variationRows = await db.select().from(nameVariations).where(eq(nameVariations.practiceId, practiceId));
  const practiceNames = Array.from(new Set([practice.name, ...variationRows.map(v => v.text)]));

  const [inMonthScans, prevMonthScans, findingRows, activityRows] = await Promise.all([
    db.select().from(scans).where(and(
      eq(scans.practiceId, practiceId), eq(scans.status, "complete"),
      gte(scans.startedAt, start), lt(scans.startedAt, end),
    )).orderBy(asc(scans.startedAt)),
    db.select().from(scans).where(and(
      eq(scans.practiceId, practiceId), eq(scans.status, "complete"),
      gte(scans.startedAt, prevStart), lt(scans.startedAt, prevEnd),
    )).orderBy(asc(scans.startedAt)),
    db.select().from(findings).where(eq(findings.practiceId, practiceId)),
    db.select().from(activities).where(and(
      eq(activities.practiceId, practiceId), gte(activities.createdAt, start), lt(activities.createdAt, end),
    )).orderBy(desc(activities.createdAt)).limit(ACTIVITY_CAP),
  ]);

  const trend = inMonthScans.map(s => ({ date: s.startedAt.toISOString(), score: s.score ?? 0 }));
  const latestInMonthScan = inMonthScans.length > 0 ? inMonthScans[inMonthScans.length - 1] : null;
  const score = latestInMonthScan ? (latestInMonthScan.score ?? 0) : null;
  const prevMonthScore = prevMonthScans.length > 0 ? (prevMonthScans[prevMonthScans.length - 1].score ?? 0) : null;

  const [inMonthChecks, prevMonthChecks] = await Promise.all([
    checksForScans(db, inMonthScans.map(s => s.id)),
    checksForScans(db, prevMonthScans.map(s => s.id)),
  ]);

  const perEngine = ENGINES.map(engine => {
    const engineChecks = inMonthChecks.filter(c => c.engine === engine);
    return {
      engine: ENGINE_LABELS[engine],
      cited: engineChecks.filter(c => c.mentioned).length,
      total: engineChecks.length,
    };
  });

  const totalChecks = inMonthChecks.length;
  const citedChecks = inMonthChecks.filter(c => c.mentioned).length;
  const pct = totalChecks > 0 ? Math.round((100 * citedChecks) / totalChecks) : 0;

  const prevTotalChecks = prevMonthChecks.length;
  const prevCitedChecks = prevMonthChecks.filter(c => c.mentioned).length;
  const prevPct = prevTotalChecks > 0 ? Math.round((100 * prevCitedChecks) / prevTotalChecks) : 0;

  const monthLabel = formatMonthLabel(monthISO);
  let verdict: string;
  if (totalChecks === 0) {
    verdict = `No AI-visibility checks were run for ${practice.name} in ${monthLabel}.`;
  } else {
    const base = `AI engines named ${practice.name} in ${pct}% of patient-question checks in ${monthLabel}`;
    if (prevMonthScans.length === 0) {
      verdict = `${base}.`;
    } else {
      const direction = pct > prevPct ? "up" : pct < prevPct ? "down" : "flat";
      verdict = `${base}, ${direction} from ${prevPct}% last month.`;
    }
  }

  const found = findingRows.filter(f => inRange(f.createdAt, start, end)).length;
  const fixed = findingRows.filter(f => f.status === "fixed" && f.resolvedAt && inRange(f.resolvedAt, start, end)).length;
  const verified = findingRows.filter(f => f.status === "verified" && f.resolvedAt && inRange(f.resolvedAt, start, end)).length;
  const open = findingRows.filter(f => f.status === "open").length;

  let bestQuote: ReportData["bestQuote"] = null;
  if (latestInMonthScan) {
    const scanChecks = await getChecksForScan(db, latestInMonthScan.id);
    for (const c of scanChecks) {
      if (!c.mentioned) continue;
      const snippet = extractSnippet(c.answerText, practiceNames);
      if (snippet) {
        bestQuote = { engine: ENGINE_LABELS[c.engine], prompt: c.promptText, snippet };
        break;
      }
    }
  }

  return {
    verdict,
    score,
    prevMonthScore,
    trend,
    perEngine,
    accuracyLedger: { found, fixed, verified, open },
    activities: activityRows.map(a => a.description),
    bestQuote,
  };
}
