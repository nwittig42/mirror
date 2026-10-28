import { describe, it, expect } from "vitest";
import { followThroughScore, forecastScores } from "@/core/score-forecast";
import type { Position } from "@/core/types";

const check = (engine: string, mentioned: boolean, competitors: string[], position: Position = mentioned ? "mentioned" : "absent") => ({
  engine, promptKind: "category" as const, mentioned, position, competitorsMentioned: competitors, namedOrder: competitors,
});

describe("followThroughScore", () => {
  it("scores the business as if its Next steps won back half the answers that named a competitor instead", () => {
    const checks = [
      check("openai", true, ["A"]), check("openai", false, ["A"]), check("openai", false, ["A"]),
      check("google", false, ["B"]), check("google", false, ["B"]), check("google", false, []),
    ];
    // Level with nobody to catch on the old target, yet four answers are being lost.
    const now = followThroughScore(checks.map(c => ({ ...c, competitorsMentioned: [] })));
    expect(followThroughScore(checks)).toBeGreaterThan(now);
  });

  it("rises toward that score over the year", () => {
    const lines = forecastScores({ now: { facts: null, visibility: 40 }, accuracy: null, target: 60 });
    const points = lines.visibility!.points;
    expect(points[0].likely).toBeGreaterThan(40);
    expect(points[points.length - 1].likely).toBe(60);
  });
});
