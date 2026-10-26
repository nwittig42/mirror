import type { CheckResult, Position, PromptKind, Severity } from "@/core/types";

export interface ScoreInput {
  checks: Pick<CheckResult, "engine" | "promptKind" | "mentioned" | "position">[];
  /** Engines the scan asked; reach is "engines that named you / engines asked". Default 4. */
  engineCount?: number;
}

export interface VisibilityParts { citationRate: number; positionQuality: number; engineBreadth: number }

const POSITION_WEIGHT: Record<Position, number> = { first: 1, top3: 0.7, mentioned: 0.4, absent: 0 };

/**
 * The three "does AI name you" measures. Branded prompts name the practice in
 * the question, so the answer names it back almost every time; they are left
 * out of every visibility term and used only for fact-checking.
 */
export function computeVisibilityParts(checks: ScoreInput["checks"], engineCount?: number): VisibilityParts {
  const earned = checks.filter(c => c.promptKind !== "branded");
  const citationRate = earned.length ? earned.filter(c => c.mentioned).length / earned.length : 0;
  const category = checks.filter(c => c.promptKind === "category");
  const positionQuality = category.length
    ? category.reduce((s, c) => s + POSITION_WEIGHT[c.position], 0) / category.length
    : 0;
  const engines = new Set(earned.filter(c => c.mentioned).map(c => c.engine));
  const engineBreadth = Math.min(1, engines.size / Math.max(1, engineCount ?? 4));
  return { citationRate, positionQuality, engineBreadth };
}

/**
 * Visibility, 0-100: 50% named rate, 20% rank, 15% reach, rescaled over 0.85.
 * Locked rule: never named on an earned prompt => 0.
 */
export function computeVisibility(checks: ScoreInput["checks"], engineCount?: number): number {
  const p = computeVisibilityParts(checks, engineCount);
  if (p.citationRate === 0) return 0;
  return Math.round(100 * (0.5 * p.citationRate + 0.2 * p.positionQuality + 0.15 * p.engineBreadth) / 0.85);
}

export interface EngineScore {
  engine: ScoreInput["checks"][number]["engine"];
  /** This tool's own visibility, 0-100. */
  score: number;
  /** Buyer-question answers from this tool that named the business. */
  named: number;
  /** Buyer-question answers this tool gave. */
  asked: number;
}

/**
 * Visibility one AI tool at a time: the same formula as `computeVisibility`,
 * over that tool's answers alone, with reach counted out of one tool (it
 * either named the business or it didn't). Best score first. Tools that gave
 * no buyer-question answers are left out.
 */
export function engineScores(checks: ScoreInput["checks"]): EngineScore[] {
  const byEngine = new Map<EngineScore["engine"], ScoreInput["checks"]>();
  for (const c of checks) byEngine.set(c.engine, [...(byEngine.get(c.engine) ?? []), c]);
  return [...byEngine.entries()]
    .map(([engine, own]) => {
      const earned = own.filter(c => c.promptKind !== "branded");
      return { engine, score: computeVisibility(own, 1), named: earned.filter(c => c.mentioned).length, asked: earned.length };
    })
    .filter(e => e.asked > 0)
    .sort((a, b) => b.score - a.score || b.named - a.named || a.engine.localeCompare(b.engine));
}

export interface ShareOfVoice {
  /** The business's part of every mention of any business, 0 to 100. Null when no answer named anyone. */
  share: number | null;
  /** Answers that named the business. */
  yours: number;
  /** Mentions of any business: the business's own plus every competitor's. */
  total: number;
}

/**
 * Share of voice: of every time an answer named a business, how many were
 * this one. A business counts once per answer, however often the answer
 * repeats its name. Branded prompts are left out, as in every visibility
 * measure: they name the business in the question.
 *
 * It answers a different question from the named rate. Named in 6 of 10
 * answers is a 60% rate; if those same answers named four competitors 34
 * times between them, the share of voice is 6 of 40, or 15%.
 */
export function shareOfVoice(
  checks: { promptKind: PromptKind; mentioned: boolean; competitorsMentioned: string[] | null }[],
): ShareOfVoice {
  const earned = checks.filter(c => c.promptKind !== "branded");
  const yours = earned.filter(c => c.mentioned).length;
  const total = yours + earned.reduce((sum, c) => sum + new Set(c.competitorsMentioned ?? []).size, 0);
  return { share: total === 0 ? null : Math.round((yours / total) * 100), yours, total };
}

export const OVERALL_WEIGHTS = { visibility: 0.7, facts: 0.3 } as const;
/** A serious wrong fact (credentials, safety, a service not offered) holds overall at this. */
export const CRITICAL_CAP = 70;

export interface OverallInput { visibility: number; factScore: number | null; hasCritical: boolean }

/**
 * Overall, built only from the two published scores so anyone can check it:
 * 70% visibility + 30% fact accuracy. Facts never lift an invisible business
 * (visibility 0 => 0); with nothing fact-checked it is visibility alone.
 */
export function computeOverall(a: OverallInput): { score: number; uncapped: number; capped: boolean } {
  const uncapped = a.visibility === 0 ? 0
    : a.factScore === null ? a.visibility
    : Math.round(OVERALL_WEIGHTS.visibility * a.visibility + OVERALL_WEIGHTS.facts * a.factScore);
  const capped = a.hasCritical && uncapped > CRITICAL_CAP;
  return { score: capped ? CRITICAL_CAP : uncapped, uncapped, capped };
}

/**
 * Every headline score a person sees runs from 30 to 100: shown = 30 + 0.7 x
 * raw. The floor keeps a struggling business from seeing a crushing number;
 * rescaling rather than clamping keeps a better business scoring higher.
 * Stored scores stay raw; this is applied only where a number is displayed.
 */
export const SHOWN_FLOOR = 30;

export function shownScore(raw: number | null): number | null {
  // Whole-number maths (x7/10), so 75 gives 52.5 exactly and rounds up to 83.
  return raw === null ? null : Math.round(SHOWN_FLOOR + (raw * 7) / 10);
}

/** The serious-error cap as a person sees it (raw 70). */
export const SHOWN_CAP = shownScore(CRITICAL_CAP)!;

/** `displayScores`' three numbers as shown. */
export function shownScores<T extends { overall: number | null; visibility: number | null; facts: number | null }>(s: T): T {
  return { ...s, overall: shownScore(s.overall), visibility: shownScore(s.visibility), facts: shownScore(s.facts) };
}

/** About how many shown points a raw points cost is worth (0.7x), as a whole number. For rules, not rows that must add up. */
export function shownPoints(points: number): number {
  return Math.round((points * 7) / 10);
}

/**
 * `total` split into whole numbers in proportion to `weights`, adding up to
 * exactly `total` (largest-remainder rounding, ties to the earlier one).
 */
export function wholeShares(weights: number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const exact = weights.map(w => (w * total) / sum);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) { if (left <= 0) break; out[i] += 1; left -= 1; }
  return out;
}

/**
 * One plain line that shows the overall's maths, shown under the score.
 * Takes the raw scores and quotes them as shown: the weights sum to 1, so the
 * sum still holds on the 30-100 scale, give or take a point of rounding.
 */
export function explainOverall(a: OverallInput): string {
  if (a.visibility === 0) {
    return `Overall is ${SHOWN_FLOOR} because AI never named you when buyers asked. Accurate facts can't lift a business AI doesn't mention.`;
  }
  if (a.factScore === null) {
    return `Overall = your visibility (${shownScore(a.visibility)}). No facts were checked this scan, so accuracy isn't counted yet.`;
  }
  const o = computeOverall(a);
  const sum = `Overall = 70% visibility (${shownScore(a.visibility)}) + 30% fact accuracy (${shownScore(a.factScore)}) = ${shownScore(o.uncapped)}`;
  return o.capped ? `${sum}, capped at ${SHOWN_CAP} because AI stated a serious wrong fact about you.` : `${sum}.`;
}

/**
 * Points each open wrong fact costs the fact score. A price error is
 * weighted 1.5x: it is the fact AI gets wrong most often and the one a buyer
 * acts on (Profound, 158K claims: pricing is 12% of claims, 24% of errors).
 */
export const FACT_PENALTY: Record<Severity, number> = { critical: 25, major: 12, minor: 4 };
export const PRICE_MULTIPLIER = 1.5;

/**
 * Fact score, 0-100: starts at 100 and loses points for every open wrong
 * fact, so the client can read it as "each mistake costs you points".
 * Returns null when nothing was judged (no fact sheet, or every judge call
 * failed): unknown is not the same as accurate.
 */
export function computeFactScore(args: {
  judgedChecks: number;
  openFindings: { severity: Severity; category: string | null }[];
}): number | null {
  if (args.judgedChecks === 0) return null;
  const penalty = args.openFindings.reduce((sum, f) =>
    sum + FACT_PENALTY[f.severity] * (f.category === "pricing" ? PRICE_MULTIPLIER : 1), 0);
  return Math.max(0, Math.round(100 - penalty));
}

/** Low/high of the per-run scores, or nulls when there were none. */
export function scoreBand(runScores: number[]): { low: number | null; high: number | null } {
  if (runScores.length === 0) return { low: null, high: null };
  return { low: Math.min(...runScores), high: Math.max(...runScores) };
}

/**
 * The three numbers to show for a scan. Scans from before the split scores
 * stored only the overall and visibility's parts: visibility is rebuilt from
 * those parts (same formula, so exact), and the old check-rate accuracy
 * stands in for the fact score, flagged as an estimate.
 */
export function displayScores(scan: {
  score: number | null; visibilityScore: number | null; factScore: number | null;
  citationRate: number | null; positionScore: number | null; breadthScore: number | null; accuracyScore: number | null;
}): { overall: number | null; visibility: number | null; facts: number | null; estimated: boolean } {
  if (scan.visibilityScore !== null) {
    return { overall: scan.score, visibility: scan.visibilityScore, facts: scan.factScore, estimated: false };
  }
  const cr = scan.citationRate;
  const visibility = cr === null ? null
    : cr === 0 ? 0
    : Math.round((0.5 * cr + 0.2 * (scan.positionScore ?? 0) + 0.15 * (scan.breadthScore ?? 0)) / 0.85);
  return { overall: scan.score, visibility, facts: scan.factScore ?? scan.accuracyScore, estimated: true };
}

export type ScoreKey = "overall" | "visibility" | "facts";

/** The latest value of one score and its change since the scan before (null when there's no earlier score). */
export function scoreTrend(
  history: Record<ScoreKey, number | null>[], key: ScoreKey,
): { now: number | null; change: number | null } {
  const last = history[history.length - 1]?.[key] ?? null;
  const prev = history.length > 1 ? history[history.length - 2][key] : null;
  return { now: last, change: last !== null && prev !== null ? last - prev : null };
}
