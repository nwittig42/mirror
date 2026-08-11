import type { CheckResult, Position, Severity } from "@/core/types";

export interface ScoreInput {
  checks: Pick<CheckResult, "engine" | "promptKind" | "mentioned" | "position">[];
  openFindings: { severity: Severity }[];
  brandedCheckCount: number;
  brandedChecksWithFinding: number;
}

export interface ScoreBreakdown {
  score: number;
  citationRate: number;
  positionQuality: number;
  engineBreadth: number;
  accuracy: number;
  capped: boolean;
}

const POSITION_WEIGHT: Record<Position, number> = {
  first: 1,
  top3: 0.7,
  mentioned: 0.4,
  absent: 0,
};

export function computeScore(input: ScoreInput): ScoreBreakdown {
  const { checks } = input;

  // Branded prompts name the practice in the question ("How much does Botox
  // cost at Glow MedSpa?"), so the answer names it back essentially every
  // time. Counting that as a citation measures nothing: it is ~100% for every
  // practice, visible or invisible. Branded checks exist to catch
  // hallucinations and are scored through `accuracy` below, which is the only
  // term they feed. Every visibility term here is computed over the prompts
  // where being named actually had to be earned.
  const visibility = checks.filter((c) => c.promptKind !== "branded");

  // citationRate = mentions / non-branded checks
  const citationRate = visibility.length
    ? visibility.filter((c) => c.mentioned).length / visibility.length
    : 0;

  // positionQuality = average of position weights for category-only prompts
  const category = checks.filter((c) => c.promptKind === "category");
  const positionQuality = category.length
    ? category.reduce((s, c) => s + POSITION_WEIGHT[c.position], 0) / category.length
    : 0;

  // engineBreadth = engines with ≥1 non-branded mention / 4. An engine that
  // named the practice only when handed its name has not covered it.
  const enginesWithMention = new Set(
    visibility.filter((c) => c.mentioned).map((c) => c.engine)
  );
  const engineBreadth = enginesWithMention.size / 4;

  // accuracy = 1 - (brandedChecksWithFinding / brandedCheckCount), or 1 when no branded checks
  const accuracy = input.brandedCheckCount
    ? 1 - input.brandedChecksWithFinding / input.brandedCheckCount
    : 1;

  // score = round(100 × (0.50·citationRate + 0.20·positionQuality + 0.15·engineBreadth + 0.15·accuracy))
  // Locked rule: zero citations => score 0; accuracy never lifts an invisible practice.
  // This also covers a scan of nothing but branded prompts: `citationRate` is 0
  // because there is no visibility evidence, so the score is 0 rather than a
  // number invented out of guaranteed self-references.
  let score = citationRate === 0
    ? 0
    : Math.round(
        100 *
          (0.5 * citationRate +
            0.2 * positionQuality +
            0.15 * engineBreadth +
            0.15 * accuracy)
      );

  // cap at 70 if open critical finding exists AND raw score > 70
  const capped =
    input.openFindings.some((f) => f.severity === "critical") && score > 70;
  if (capped) score = 70;

  return { score, citationRate, positionQuality, engineBreadth, accuracy, capped };
}
