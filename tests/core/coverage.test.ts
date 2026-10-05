import { describe, it, expect } from "vitest";
import { summarizeCoverage, coverageLabel, blockedReason } from "@/core/coverage";
import type { Engine } from "@/core/types";

const res = (engine: Engine, ok: number, fail: number) => [
  ...Array(ok).fill({ engine, ok: true }), ...Array(fail).fill({ engine, ok: false }),
];

describe("coverage", () => {
  it("counts per engine and overall", () => {
    const c = summarizeCoverage([...res("openai", 10, 0), ...res("gemini", 0, 10)]);
    expect(c).toMatchObject({ asked: 20, answered: 10, missing: ["gemini"], blocked: true });
    expect(c.engines).toEqual([{ engine: "openai", asked: 10, answered: 10 }, { engine: "gemini", asked: 10, answered: 0 }]);
  });
  it("is not blocked at exactly 75%", () => {
    expect(summarizeCoverage([...res("openai", 3, 0), ...res("gemini", 0, 1)]).blocked).toBe(false);
  });
  it("marks an engine missing under half, not at half", () => {
    expect(summarizeCoverage([...res("openai", 4, 0), ...res("grok", 1, 1)]).missing).toEqual([]);
    expect(summarizeCoverage([...res("openai", 4, 0), ...res("grok", 1, 2)]).missing).toEqual(["grok"]);
  });
  it("treats an empty scan as complete", () => {
    expect(summarizeCoverage([])).toMatchObject({ asked: 0, answered: 0, missing: [], blocked: false });
  });
  it("labels only when an engine is missing", () => {
    const four = (["openai", "anthropic", "grok", "perplexity"] as Engine[]).flatMap(e => res(e, 10, 0));
    expect(coverageLabel(summarizeCoverage(four))).toBeNull();
    expect(coverageLabel(summarizeCoverage([...four, ...res("gemini", 0, 10)])))
      .toBe("Based on 4 of 5 AI tools. Gemini didn't respond.");
    expect(coverageLabel(null)).toBeNull();
  });
  it("explains a block", () => {
    const c = summarizeCoverage([...res("openai", 6, 0), ...res("gemini", 0, 2), ...res("grok", 0, 2)]);
    expect(blockedReason(c)).toBe("Only 60% of answers came back. Gemini and Grok didn't respond.");
  });
});
