import { computeOverall, computeVisibility } from "@/core/scoring";
import type { Position, PromptKind } from "@/core/types";
import { FORECAST_MONTHS, seriousLeft, type AccuracyForecast, type AccuracyPoint } from "@/core/accuracy-forecast";
import { FOLLOW_THROUGH, type Range } from "@/core/forecast";

/**
 * Where all three scores could go over the next 12 months, for one chart:
 *
 * - Accuracy rises as wrong facts are fixed (src/core/accuracy-forecast.ts).
 * - Recommended by AI rises toward what following the Next steps earns
 *   (followThroughScore), never less than the score of the competitor AI
 *   names most, at the pace the leads forecast is drawn at.
 * - Overall is worked out from those two with the same formula a scan uses.
 */

/**
 * Months to close the gap to the competitor: the likely pace is the one the
 * leads forecast uses; the range is twice as fast and twice as slow. Nobody
 * has measured this, so it is an assumption and the page says so.
 */
export const PACE_RANGE_MONTHS: Range = { low: 24, likely: 12, high: 6 };

export interface ScoreCheck {
  engine: string;
  promptKind: PromptKind;
  competitorsMentioned: string[] | null;
  namedOrder: string[] | null;
}

/**
 * The Recommended by AI score the competitor would get from the same answers:
 * how often it is named, how high, and by how many of the tools.
 */
export function competitorScore(checks: ScoreCheck[], competitor: string): number {
  const engines = new Set(checks.map(c => c.engine)).size;
  return computeVisibility(checks.map(c => {
    const mentioned = (c.competitorsMentioned ?? []).includes(competitor);
    const place = (c.namedOrder ?? []).indexOf(competitor);
    const position: Position = !mentioned ? "absent" : place === 0 ? "first" : place > 0 && place < 3 ? "top3" : "mentioned";
    return { engine: c.engine as never, promptKind: c.promptKind, mentioned, position };
  }), engines);
}

/**
 * The Recommended by AI score the business would get by following its Next
 * steps: the same answers, with FOLLOW_THROUGH's likely share of those that
 * named a competitor and not the business turned into answers that name it
 * in the top three, alongside the businesses AI already lists there. Branded questions stay
 * out, as in every visibility score.
 */
export function followThroughScore(checks: (ScoreCheck & { mentioned: boolean; position: Position })[]): number {
  const engines = new Set(checks.map(c => c.engine)).size;
  const lost = checks.filter(c => c.promptKind !== "branded" && !c.mentioned && (c.competitorsMentioned?.length ?? 0) > 0);
  const won = new Set(lost.slice(0, Math.round(lost.length * FOLLOW_THROUGH.likely)));
  return computeVisibility(checks.map(c => ({
    engine: c.engine as never, promptKind: c.promptKind,
    mentioned: c.mentioned || won.has(c),
    position: won.has(c) ? "top3" : c.position,
  })), engines);
}

export interface ScoreLine {
  now: number;
  /** The forecast at 3, 6, 9 and 12 months. */
  points: AccuracyPoint[];
}

export interface ScoreForecast {
  facts: ScoreLine | null;
  visibility: ScoreLine | null;
  overall: ScoreLine | null;
}

/**
 * The three lines. A score with nothing to forecast stays level: Accuracy
 * with no wrong facts, Recommended by AI with no competitor ahead. A score
 * the scan did not produce has no line.
 */
export function forecastScores(args: {
  /** Scores in the latest scan. */
  now: { facts: number | null; visibility: number | null };
  accuracy: AccuracyForecast | null;
  /** Where Recommended by AI is headed: what the Next steps earn, or the top competitor's score if higher. Null when there's nothing to aim at. */
  target: number | null;
}): ScoreForecast {
  const level = (value: number): AccuracyPoint[] => FORECAST_MONTHS.map(month => ({ month, low: value, likely: value, high: value }));

  const facts: ScoreLine | null = args.accuracy ? { now: args.accuracy.now, points: args.accuracy.points }
    : args.now.facts === null ? null : { now: args.now.facts, points: level(args.now.facts) };

  const v = args.now.visibility;
  const gap = v === null || args.target === null ? 0 : Math.max(0, args.target - v);
  const reached = (month: number, pace: number) => Math.round(v! + gap * Math.min(1, month / pace));
  const visibility: ScoreLine | null = v === null ? null : {
    now: v,
    points: FORECAST_MONTHS.map(month => ({
      month, low: reached(month, PACE_RANGE_MONTHS.low), likely: reached(month, PACE_RANGE_MONTHS.likely), high: reached(month, PACE_RANGE_MONTHS.high),
    })),
  };

  const wrong = args.accuracy?.facts ?? [];
  const overallAt = (visibilityScore: number, factScore: number | null, hasCritical: boolean) =>
    computeOverall({ visibility: visibilityScore, factScore, hasCritical }).score;
  const overall: ScoreLine | null = !visibility ? null : {
    now: overallAt(visibility.now, facts?.now ?? null, wrong.some(f => f.severity === "critical")),
    points: visibility.points.map((p, i) => {
      const f = facts?.points[i];
      return {
        month: p.month,
        low: overallAt(p.low, f?.low ?? null, seriousLeft(wrong, p.month, "low")),
        likely: overallAt(p.likely, f?.likely ?? null, seriousLeft(wrong, p.month, "likely")),
        high: overallAt(p.high, f?.high ?? null, seriousLeft(wrong, p.month, "high")),
      };
    }),
  };
  return { facts, visibility, overall };
}
