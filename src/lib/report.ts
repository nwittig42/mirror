import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import type { Db } from "@/db";
import { activities, checks, findings, nameVariations, practices, prompts, scans } from "@/db/schema";
import { getChecksForScan } from "@/lib/queries";
import { extractSnippet } from "@/core/mention";
import { ENGINES, ENGINE_LABELS } from "@/core/types";
import { displayScores, shownScore, shownScores } from "@/core/scoring";

export interface ReportData {
  verdict: string;
  score: number | null;
  prevMonthScore: number | null;
  trend: { date: string; score: number }[];
  perEngine: { engine: string; cited: number; total: number }[];
  /** % of non-branded checks in the month where an engine named the practice. */
  citationPct: number;
  accuracyLedger: { found: number; fixed: number; verified: number; open: number };
  activities: string[];
  bestQuote: { engine: string; prompt: string; snippet: string } | null;
  /** The last six months, oldest first, each with the scores of its last scan (nulls when it had none). */
  months: MonthPoint[];
  /** This month's numbers next to the last month that had a scan, for the "improved / got worse" summary. */
  changes: MonthChange[];
  /** The month the scores are compared with ("Aug"), or null when no earlier month in the history had a scan. */
  comparedTo: string | null;
}

export interface MonthPoint { month: string; label: string; overall: number | null; visibility: number | null; facts: number | null }

/** One number this month and in the month it is compared with. Every one of them is better when higher. */
export interface MonthChange { key: "overall" | "visibility" | "facts" | "named"; label: string; now: number | null; before: number | null; unit: "" | "%" }

/** How many months the progress graph goes back, the report's month included. */
export const HISTORY_MONTHS = 6;

/**
 * Sorts the month's changes into what improved, what got worse and what held,
 * each as one plain sentence. A number missing on either side (no scan that
 * month, or nothing fact-checked) is left out: there is nothing to compare.
 */
export function reviewChanges(changes: MonthChange[]): { improved: string[]; worse: string[]; same: string[] } {
  const out = { improved: [] as string[], worse: [] as string[], same: [] as string[] };
  for (const c of changes) {
    if (c.now === null || c.before === null) continue;
    const from = `${c.before}${c.unit}`;
    const to = `${c.now}${c.unit}`;
    if (c.now > c.before) out.improved.push(`${c.label} rose from ${from} to ${to}`);
    else if (c.now < c.before) out.worse.push(`${c.label} fell from ${from} to ${to}`);
    else out.same.push(`${c.label} held at ${to}`);
  }
  return out;
}

// Every piece of work in the month is listed; the cap only guards a runaway log.
const ACTIVITY_CAP = 200;
const MONTH_ISO_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function currentMonthISO(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Validates the `?month=` search param against "YYYY-MM" (01-12). Missing or
 * malformed input (e.g. "garbage", "2026", "2026-13", all user-reachable via
 * a shareable URL) falls back silently to the current UTC month, the same
 * default used when the param is absent. `monthBounds`/`formatMonthLabel`
 * both assume a value that has already passed through here or is otherwise
 * known-valid; they'll throw on garbage input (e.g. an Invalid Date's
 * `toLocaleString` raises `RangeError`), so callers reading `month` from a
 * request must always route it through this first.
 */
export function resolveMonthParam(raw: string | undefined): string {
  if (raw && MONTH_ISO_PATTERN.test(raw)) return raw;
  return currentMonthISO();
}

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

/** All checks belonging to any of `scanIds`. Skips the query (and an invalid empty `IN ()`) when there are none. */
/**
 * Checks for a set of scans, carrying the kind of prompt each one answered.
 * The kind is needed because branded prompts are excluded from every citation
 * number the client sees: they name the practice in the question, so the
 * answer names it back regardless of how visible the practice actually is.
 */
async function checksForScans(
  db: Db,
  scanIds: string[],
): Promise<{ engine: string; mentioned: boolean; promptKind: string }[]> {
  if (scanIds.length === 0) return [];
  return db.select({
    engine: checks.engine,
    mentioned: checks.mentioned,
    promptKind: prompts.kind,
  })
    .from(checks)
    .innerJoin(prompts, eq(checks.promptId, prompts.id))
    .where(inArray(checks.scanId, scanIds));
}

/**
 * Builds every number the printable monthly client report needs, scoped to
 * completed scans whose `startedAt` falls within the given calendar month
 * (UTC). Every field is traceable to stored checks/findings/activities, with no
 * estimates. Degrades gracefully (nulls/empty arrays/zero counts) when a
 * practice has no completed scans in the requested month.
 */
export async function buildReportData(db: Db, practiceId: string, monthISO: string): Promise<ReportData> {
  const { start, end, prevStart, prevEnd } = monthBounds(monthISO);

  const [practice] = await db.select().from(practices).where(eq(practices.id, practiceId));
  const variationRows = await db.select().from(nameVariations).where(eq(nameVariations.practiceId, practiceId));
  const practiceNames = Array.from(new Set([practice.name, ...variationRows.map(v => v.text)]));

  const historyStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - (HISTORY_MONTHS - 1), 1));
  const [inMonthScans, prevMonthScans, findingRows, activityRows, historyScans] = await Promise.all([
    db.select().from(scans).where(and(
      eq(scans.practiceId, practiceId), eq(scans.status, "complete"),
      gte(scans.startedAt, start), lt(scans.startedAt, end),
    )).orderBy(asc(scans.startedAt)),
    db.select().from(scans).where(and(
      eq(scans.practiceId, practiceId), eq(scans.status, "complete"),
      gte(scans.startedAt, prevStart), lt(scans.startedAt, prevEnd),
    )).orderBy(asc(scans.startedAt)),
    db.select().from(findings).where(eq(findings.practiceId, practiceId)),
    // Client-visible rows only: the monthly report is the client's answer to
    // "what am I paying for", not a dump of the operator's diagnostics.
    db.select().from(activities).where(and(
      eq(activities.practiceId, practiceId), eq(activities.visibility, "client"),
      gte(activities.createdAt, start), lt(activities.createdAt, end),
    )).orderBy(desc(activities.createdAt)).limit(ACTIVITY_CAP),
    db.select().from(scans).where(and(
      eq(scans.practiceId, practiceId), eq(scans.status, "complete"),
      gte(scans.startedAt, historyStart), lt(scans.startedAt, end),
    )).orderBy(asc(scans.startedAt)),
  ]);

  // One point per month: the scores of that month's last scan, as shown (30-100),
  // so the changes below are between the numbers on screen.
  const months: MonthPoint[] = Array.from({ length: HISTORY_MONTHS }, (_, i) => {
    const from = new Date(Date.UTC(historyStart.getUTCFullYear(), historyStart.getUTCMonth() + i, 1));
    const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
    const last = historyScans.filter(sc => inRange(sc.startedAt, from, to)).pop();
    const shown = last ? shownScores(displayScores(last)) : null;
    return {
      month: `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, "0")}`,
      label: from.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      overall: shown?.overall ?? null, visibility: shown?.visibility ?? null, facts: shown?.facts ?? null,
    };
  });

  const trend = inMonthScans.map(s => ({ date: s.startedAt.toISOString(), score: shownScore(s.score ?? 0)! }));
  const latestInMonthScan = inMonthScans.length > 0 ? inMonthScans[inMonthScans.length - 1] : null;
  const score = latestInMonthScan ? shownScore(latestInMonthScan.score ?? 0) : null;
  const prevMonthScore = prevMonthScans.length > 0 ? shownScore(prevMonthScans[prevMonthScans.length - 1].score ?? 0) : null;

  const [inMonthChecks, prevMonthChecks] = await Promise.all([
    checksForScans(db, inMonthScans.map(s => s.id)),
    checksForScans(db, prevMonthScans.map(s => s.id)),
  ]);

  // Branded prompts are excluded from every number below. See checksForScans:
  // they are a hallucination test, not evidence that anyone can find you.
  const inMonthVisibility = inMonthChecks.filter(c => c.promptKind !== "branded");
  const prevMonthVisibility = prevMonthChecks.filter(c => c.promptKind !== "branded");

  const perEngine = ENGINES.map(engine => {
    const engineChecks = inMonthVisibility.filter(c => c.engine === engine);
    return {
      engine: ENGINE_LABELS[engine],
      cited: engineChecks.filter(c => c.mentioned).length,
      total: engineChecks.length,
    };
  });

  const totalChecks = inMonthVisibility.length;
  const citedChecks = inMonthVisibility.filter(c => c.mentioned).length;
  const pct = totalChecks > 0 ? Math.round((100 * citedChecks) / totalChecks) : 0;

  const prevTotalChecks = prevMonthVisibility.length;
  const prevCitedChecks = prevMonthVisibility.filter(c => c.mentioned).length;
  const prevPct = prevTotalChecks > 0 ? Math.round((100 * prevCitedChecks) / prevTotalChecks) : 0;

  const monthLabel = formatMonthLabel(monthISO);
  let verdict: string;
  if (totalChecks === 0) {
    verdict = `No AI-visibility checks were run for ${practice.name} in ${monthLabel}.`;
  } else {
    // Spells out the denominator. "Checks" alone reads as every check that
    // ran, which is not what this is: questions naming the practice are
    // excluded, because they are answered with the name every time.
    const base = `AI engines named ${practice.name} in ${pct}% of answers to questions that didn't name them, in ${monthLabel}`;
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
      // The row's own competitors tell the matcher that "X and Y are both
      // good" is a list, so the sentence that earned the mention is quoted.
      const snippet = extractSnippet(c.answerText, practiceNames, [...c.competitorsMentioned, ...c.namedOrder]);
      if (snippet) {
        bestQuote = { engine: ENGINE_LABELS[c.engine], prompt: c.promptText, snippet };
        break;
      }
    }
  }

  // Compare with the last earlier month that had a scan, so a skipped month doesn't blank the comparison.
  const thisMonth = months[months.length - 1];
  const earlier = months.slice(0, -1).reverse().find(m => m.overall !== null) ?? null;
  const namedBefore = earlier && earlier === months[months.length - 2] && prevTotalChecks > 0 ? prevPct : null;
  const changes: MonthChange[] = [
    { key: "overall", label: "Overall", now: thisMonth.overall, before: earlier?.overall ?? null, unit: "" },
    { key: "visibility", label: "Recommended by AI", now: thisMonth.visibility, before: earlier?.visibility ?? null, unit: "" },
    { key: "facts", label: "Accuracy", now: thisMonth.facts, before: earlier?.facts ?? null, unit: "" },
    { key: "named", label: "Answers that named you", now: totalChecks > 0 ? pct : null, before: namedBefore, unit: "%" },
  ];

  return {
    months,
    changes,
    comparedTo: earlier?.label ?? null,
    verdict,
    score,
    prevMonthScore,
    trend,
    perEngine,
    citationPct: pct,
    accuracyLedger: { found, fixed, verified, open },
    activities: activityRows.map(a => a.description),
    bestQuote,
  };
}
