import { describe, it, expect } from "vitest";
import {
  computeVisibilityParts, computeVisibility, computeOverall, explainOverall, computeFactScore, scoreBand, displayScores, shareOfVoice, engineScores,
  shownScore, shownScores, shownPoints, SHOWN_FLOOR, SHOWN_CAP,
} from "@/core/scoring";
import type { ScoreInput } from "@/core/scoring";

const check = (engine: string, kind: string, mentioned: boolean, position: string) =>
  ({ engine, promptKind: kind, mentioned, position }) as ScoreInput["checks"][number];

describe("computeVisibilityParts", () => {
  it("ignores branded prompts for the named rate", () => {
    const p = computeVisibilityParts([
      check("openai", "branded", true, "mentioned"),
      check("openai", "category", false, "absent"),
      check("openai", "informational", true, "mentioned"),
    ]);
    expect(p.citationRate).toBeCloseTo(0.5);
  });
  it("counts only category prompts for rank", () => {
    const p = computeVisibilityParts([check("openai", "branded", true, "first"), check("openai", "category", true, "mentioned")]);
    expect(p.positionQuality).toBeCloseTo(0.4);
  });
  it("measures reach against engines asked, not branded-only engines", () => {
    const p = computeVisibilityParts([
      check("openai", "category", true, "first"),
      check("anthropic", "branded", true, "mentioned"),
    ], 5);
    expect(p.engineBreadth).toBeCloseTo(0.2);
  });
});

describe("computeOverall", () => {
  it("is 70% visibility + 30% facts", () => {
    expect(computeOverall({ visibility: 60, factScore: 80, hasCritical: false }))
      .toEqual({ score: 66, uncapped: 66, capped: false });
  });
  it("is visibility alone when no facts were checked", () => {
    expect(computeOverall({ visibility: 55, factScore: null, hasCritical: false }).score).toBe(55);
  });
  it("is 0 when AI never named them, however accurate", () => {
    expect(computeOverall({ visibility: 0, factScore: 100, hasCritical: false }).score).toBe(0);
  });
  it("caps at 70 with a serious wrong fact", () => {
    expect(computeOverall({ visibility: 100, factScore: 75, hasCritical: true }))
      .toEqual({ score: 70, uncapped: 93, capped: true });
  });
  it("doesn't cap a score already at or under 70", () => {
    expect(computeOverall({ visibility: 50, factScore: 75, hasCritical: true }))
      .toEqual({ score: 58, uncapped: 58, capped: false });
  });
});

describe("shownScore", () => {
  it("maps 0-100 onto 30-100", () => {
    expect(shownScore(0)).toBe(30);
    expect(shownScore(50)).toBe(65);
    expect(shownScore(100)).toBe(100);
    expect(SHOWN_FLOOR).toBe(30);
  });
  it("rounds to a whole number", () => {
    expect(shownScore(1)).toBe(31);
    expect(shownScore(2)).toBe(31);
    expect(shownScore(75)).toBe(83);
    expect(shownScore(41)).toBe(59);
  });
  it("keeps a missing score missing", () => {
    expect(shownScore(null)).toBeNull();
  });
  it("keeps the score bands exactly where they were", () => {
    expect([shownScore(69), shownScore(70)]).toEqual([78, 79]);
    expect([shownScore(39), shownScore(40)]).toEqual([57, 58]);
    expect(SHOWN_CAP).toBe(79);
  });
  it("maps all three scores and keeps the estimate flag", () => {
    expect(shownScores({ overall: 41, visibility: 29, facts: null, estimated: true }))
      .toEqual({ overall: 59, visibility: 50, facts: null, estimated: true });
  });
  it("shows a points cost at 0.7x, to one decimal", () => {
    expect([25, 12, 4, 37.5].map(shownPoints)).toEqual([17.5, 8.4, 2.8, 26.3]);
  });
});

describe("explainOverall", () => {
  it("spells out the weights, in the scores a person sees", () => {
    expect(explainOverall({ visibility: 60, factScore: 80, hasCritical: false }))
      .toBe("Overall = 70% visibility (72) + 30% fact accuracy (86) = 76.");
  });
  it("says why when capped", () => {
    expect(explainOverall({ visibility: 100, factScore: 75, hasCritical: true }))
      .toBe("Overall = 70% visibility (100) + 30% fact accuracy (83) = 95, capped at 79 because AI stated a serious wrong fact about you.");
  });
  it("covers no facts checked", () => {
    expect(explainOverall({ visibility: 55, factScore: null, hasCritical: false }))
      .toBe("Overall = your visibility (69). No facts were checked this scan, so accuracy isn't counted yet.");
  });
  it("covers never named", () => {
    expect(explainOverall({ visibility: 0, factScore: 90, hasCritical: false }))
      .toBe("Overall is 30 because AI never named you when buyers asked. Accurate facts can't lift a business AI doesn't mention.");
  });
});

describe("computeVisibility", () => {
  it("is 100 when named first on every engine", () => {
    const checks = ["openai", "anthropic", "gemini", "perplexity"].map(e => check(e, "category", true, "first"));
    expect(computeVisibility(checks)).toBe(100);
  });
  it("is 0 when only branded prompts named them", () => {
    expect(computeVisibility([check("openai", "branded", true, "first")])).toBe(0);
  });
  it("ignores accuracy entirely", () => {
    const checks = [check("perplexity", "category", true, "first")];
    expect(computeVisibility(checks)).toBe(Math.round(100 * (0.5 + 0.2 + 0.15 * 0.25) / 0.85));
  });
});

describe("computeFactScore", () => {
  it("is null when nothing was judged", () => {
    expect(computeFactScore({ judgedChecks: 0, openFindings: [] })).toBeNull();
  });
  it("is 100 with no open wrong facts", () => {
    expect(computeFactScore({ judgedChecks: 3, openFindings: [] })).toBe(100);
  });
  it("subtracts per severity and weights price errors 1.5x", () => {
    expect(computeFactScore({ judgedChecks: 3, openFindings: [
      { severity: "major", category: "services" },
      { severity: "major", category: "pricing" },
      { severity: "minor", category: null },
    ] })).toBe(100 - 12 - 18 - 4);
  });
  it("never goes below 0", () => {
    expect(computeFactScore({ judgedChecks: 1, openFindings: Array(6).fill({ severity: "critical", category: null }) }))
      .toBe(0);
  });
});

describe("scoreBand", () => {
  it("returns min and max", () => {
    expect(scoreBand([42, 38, 46])).toEqual({ low: 38, high: 46 });
  });
  it("is null when empty", () => {
    expect(scoreBand([])).toEqual({ low: null, high: null });
  });
});

describe("engineCount", () => {
  it("measures breadth against the engines actually asked", () => {
    const checks = ["openai", "anthropic", "gemini", "perplexity"].map(e => check(e, "category", true, "first"));
    expect(computeVisibilityParts(checks).engineBreadth).toBe(1);
    expect(computeVisibilityParts(checks, 5).engineBreadth).toBeCloseTo(0.8);
    expect(computeVisibility(checks, 5)).toBeLessThan(100);
  });
});

describe("displayScores", () => {
  it("uses the stored scores on a current scan", () => {
    expect(displayScores({ score: 66, visibilityScore: 60, factScore: 80, citationRate: 50, positionScore: 40, breadthScore: 80, accuracyScore: null }))
      .toEqual({ overall: 66, visibility: 60, facts: 80, estimated: false });
  });
  it("rebuilds visibility for an older scan from its parts, and estimates facts from its old accuracy", () => {
    // 100 × (0.5·31 + 0.2·16 + 0.15·75) / 85 = 35.2
    expect(displayScores({ score: 35, visibilityScore: null, factScore: null, citationRate: 31, positionScore: 16, breadthScore: 75, accuracyScore: 33 }))
      .toEqual({ overall: 35, visibility: 35, facts: 33, estimated: true });
  });
  it("keeps the never-named rule for older scans", () => {
    expect(displayScores({ score: 0, visibilityScore: null, factScore: null, citationRate: 0, positionScore: 0, breadthScore: 0, accuracyScore: 33 }).visibility).toBe(0);
  });
});

describe("shareOfVoice", () => {
  const check = (mentioned: boolean, competitorsMentioned: string[] | null, promptKind: "category" | "branded" | "informational" = "category") =>
    ({ promptKind, mentioned, competitorsMentioned });

  it("is the business's part of every mention of any business", () => {
    const checks = [
      check(true, ["Rose City Plumbing", "Roto-Rooter"]),
      check(false, ["Rose City Plumbing"]),
      check(true, []),
      check(false, ["Roto-Rooter", "Mr. Rooter"]),
    ];
    // Named in 2 of 4 answers, but 2 of 7 mentions.
    expect(shareOfVoice(checks)).toEqual({ share: 29, yours: 2, total: 7 });
  });

  it("counts a business once per answer and leaves branded prompts out", () => {
    expect(shareOfVoice([
      check(true, ["Roto-Rooter", "Roto-Rooter"]),
      check(true, ["Roto-Rooter"], "branded"),
      check(false, null, "informational"),
    ])).toEqual({ share: 50, yours: 1, total: 2 });
  });

  it("is the whole voice when nobody else is named, and nothing when nobody is", () => {
    expect(shareOfVoice([check(true, [])])).toEqual({ share: 100, yours: 1, total: 1 });
    expect(shareOfVoice([check(false, [])])).toEqual({ share: null, yours: 0, total: 0 });
    expect(shareOfVoice([])).toEqual({ share: null, yours: 0, total: 0 });
  });
});

describe("engineScores", () => {
  const c = (engine: "openai" | "anthropic" | "gemini", promptKind: "category" | "branded" | "informational", mentioned: boolean, position: "first" | "top3" | "mentioned" | "absent" = mentioned ? "mentioned" : "absent") =>
    ({ engine, promptKind, mentioned, position });

  it("scores each AI tool on its own answers, best first", () => {
    const scores = engineScores([
      c("openai", "category", false), c("openai", "category", false),
      c("anthropic", "category", true, "first"), c("anthropic", "category", false),
    ]);
    expect(scores.map(s => s.engine)).toEqual(["anthropic", "openai"]);
    // Named in 1 of 2, first once (rank 0.5), reach 1 of 1: (0.25 + 0.1 + 0.15) / 0.85 = 59.
    expect(scores[0]).toEqual({ engine: "anthropic", score: 59, named: 1, asked: 2 });
    expect(scores[1]).toEqual({ engine: "openai", score: 0, named: 0, asked: 2 });
  });
  it("leaves branded questions out of the counts and drops a tool that only answered those", () => {
    const scores = engineScores([
      c("openai", "branded", true), c("openai", "informational", true),
      c("gemini", "branded", true),
    ]);
    expect(scores).toEqual([{ engine: "openai", score: 76, named: 1, asked: 1 }]);
  });
});
