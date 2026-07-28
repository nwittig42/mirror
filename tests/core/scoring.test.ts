import { describe, it, expect } from "vitest";
import { computeScore } from "@/core/scoring";
import type { ScoreInput } from "@/core/scoring";

const check = (engine: string, kind: string, mentioned: boolean, position: string) =>
  ({ engine, promptKind: kind, mentioned, position }) as ScoreInput["checks"][number];

describe("computeScore", () => {
  it("zero everything → 0", () => {
    const r = computeScore({ checks: [check("openai", "category", false, "absent")],
      openFindings: [], brandedCheckCount: 0, brandedChecksWithFinding: 0 });
    expect(r.score).toBe(0);
  });
  it("perfect single-engine run is held back by breadth", () => {
    const r = computeScore({
      checks: [check("perplexity", "category", true, "first")],
      openFindings: [], brandedCheckCount: 0, brandedChecksWithFinding: 0 });
    // cr=1, pos=1, breadth=0.25, accuracy defaults to 1 when no branded checks
    expect(r.score).toBe(Math.round(100 * (0.5 + 0.2 + 0.15 * 0.25 + 0.15)));
  });
  it("caps at 70 with an open critical finding", () => {
    const r = computeScore({
      checks: ["openai", "anthropic", "gemini", "perplexity"].map(e => check(e, "category", true, "first")),
      openFindings: [{ severity: "critical" }], brandedCheckCount: 4, brandedChecksWithFinding: 1 });
    expect(r.capped).toBe(true);
    expect(r.score).toBe(70);
  });
  it("position quality only counts category prompts", () => {
    const r = computeScore({
      checks: [check("openai", "branded", true, "first"), check("openai", "category", true, "mentioned")],
      openFindings: [], brandedCheckCount: 1, brandedChecksWithFinding: 0 });
    expect(r.positionQuality).toBeCloseTo(0.4);
  });
  it("locked rule: zero citations with perfect accuracy still scores 0", () => {
    const r = computeScore({
      checks: ["openai", "anthropic", "gemini", "perplexity"].map(e => check(e, "category", false, "absent")),
      openFindings: [], brandedCheckCount: 4, brandedChecksWithFinding: 0 });
    // Zero citations forces score to 0, despite perfect accuracy=1
    expect(r.score).toBe(0);
    expect(r.accuracy).toBe(1);
  });
});
