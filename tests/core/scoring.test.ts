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
  it("citation rate ignores branded prompts, which are ~100% by construction", () => {
    // Asking "what is Glow MedSpa?" and scoring yourself for the answer saying
    // "Glow MedSpa" is not visibility. Branded checks earn their keep through
    // the accuracy term instead.
    const r = computeScore({
      checks: [
        check("openai", "branded", true, "mentioned"),
        check("openai", "branded", true, "mentioned"),
        check("openai", "category", false, "absent"),
        check("openai", "informational", false, "absent"),
      ],
      openFindings: [], brandedCheckCount: 2, brandedChecksWithFinding: 0 });
    expect(r.citationRate).toBe(0);
    expect(r.score).toBe(0);
  });

  it("citation rate counts category and informational prompts", () => {
    const r = computeScore({
      checks: [
        check("openai", "category", true, "first"),
        check("openai", "informational", false, "absent"),
        check("openai", "branded", true, "mentioned"),
      ],
      openFindings: [], brandedCheckCount: 1, brandedChecksWithFinding: 0 });
    expect(r.citationRate).toBeCloseTo(0.5);
  });

  it("engine breadth ignores engines that only ever named them on a branded prompt", () => {
    // An engine that names you only when you hand it your name has not
    // covered you, so it must not count toward breadth either.
    const r = computeScore({
      checks: [
        check("openai", "category", true, "first"),
        check("anthropic", "branded", true, "mentioned"),
        check("gemini", "branded", true, "mentioned"),
        check("perplexity", "branded", true, "mentioned"),
      ],
      openFindings: [], brandedCheckCount: 3, brandedChecksWithFinding: 0 });
    expect(r.engineBreadth).toBeCloseTo(0.25);
  });

  it("scores 0 when the only checks that ran were branded", () => {
    // No visibility evidence at all. Reporting anything above zero off branded
    // checks alone would be inventing a number.
    const r = computeScore({
      checks: [check("openai", "branded", true, "mentioned")],
      openFindings: [], brandedCheckCount: 1, brandedChecksWithFinding: 0 });
    expect(r.citationRate).toBe(0);
    expect(r.score).toBe(0);
  });

  it("accuracy still counts branded checks, since that is what they are for", () => {
    const r = computeScore({
      checks: [check("openai", "category", true, "first"), check("openai", "branded", true, "mentioned")],
      openFindings: [], brandedCheckCount: 4, brandedChecksWithFinding: 1 });
    expect(r.accuracy).toBeCloseTo(0.75);
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
