import type { Db } from "@/db";
import { getChecksForScan, getFindingsForPractice, getLatestScan, getScoreHistory } from "@/lib/queries";
import { mentionRates } from "@/core/forecast";
import { competitorScore, forecastScores, type ScoreForecast } from "@/core/score-forecast";
import { displayScores } from "@/core/scoring";
import { fixSource, forecastAccuracy, type AccuracyForecast } from "@/core/accuracy-forecast";

export interface LoadedAccuracy {
  forecast: AccuracyForecast | null;
  /** The three scores in the last few scans, oldest first, for the lines before the forecast. */
  history: { date: Date; facts: number | null; visibility: number | null; overall: number | null }[];
  /** All three scores over the next 12 months, for the chart. */
  scores: ScoreForecast;
  /** The competitor Recommended by AI is heading toward. Null when AI named none. */
  competitor: string | null;
  /** True when the latest scan checked facts at all. */
  checked: boolean;
}

/**
 * The Accuracy forecast for a business, from the wrong facts its latest scan
 * repeated: the same ones that cost its score points. Older open findings the
 * scan did not see again cost nothing, so they are not forecast either.
 */
export async function loadAccuracyForecast(db: Db, practice: { id: string; website: string | null }): Promise<LoadedAccuracy> {
  const scan = await getLatestScan(db, practice.id);
  if (!scan) return { forecast: null, history: [], checked: false, scores: { facts: null, visibility: null, overall: null }, competitor: null };
  const [all, history, checks] = await Promise.all([
    getFindingsForPractice(db, practice.id), getScoreHistory(db, practice.id, 5), getChecksForScan(db, scan.id),
  ]);
  const scores = displayScores(scan);
  const wrong = all
    .filter(f => f.status === "open" && f.lastSeenScanId === scan.id)
    .map(f => ({
      label: f.factLabel ?? f.claim, severity: f.severity, category: f.factCategory,
      source: fixSource(f.citations ?? [], practice.website),
    }));
  const forecast = forecastAccuracy({ judgedChecks: scan.factScore === null ? 0 : 1, wrong });
  const { competitor } = mentionRates(checks);
  return {
    forecast,
    history: history.map(h => ({ date: h.date, facts: h.facts, visibility: h.visibility, overall: h.overall })),
    checked: scan.factScore !== null,
    scores: forecastScores({
      now: { facts: scores.facts, visibility: scores.visibility }, accuracy: forecast,
      target: competitor ? competitorScore(checks, competitor) : null,
    }),
    competitor,
  };
}
