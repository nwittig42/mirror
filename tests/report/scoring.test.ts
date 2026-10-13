import { describe, it, expect } from "vitest";
import sample from "@/report/sample-audit.json";
import type { AuditReport } from "@/report/types";
import * as s from "@/report/scoring";

// The design kit's own sanity checks against its sample data, kept passing.
const r = sample as unknown as AuditReport;

describe("design kit scoring (sample data)", () => {
  it("matches the sample's scores", () => {
    expect(s.overallScore(r.scores.components)).toBe(r.scores.overall.value);
    expect(s.visibilityScore(r.scores.components)).toBe(r.scores.visibility);
    expect(s.componentPoints(r.scores.components)).toEqual([5, 5, 10, 21]);
    expect(s.factAccuracy(r.facts)).toBe(r.scores.factAccuracy);
    expect([34, 29, 70, 61].map(s.scoreBand)).toEqual(["needs_work", "needs_work", "strong", "fair"]);
  });
  it("sorts and counts", () => {
    expect(s.sortedWrongFacts(r.facts).map(f => f.id)).toEqual(["f1", "f2", "f3"]);
    expect(s.severityCounts(r.facts)).toEqual({ critical: 1, major: 2, minor: 0 });
    expect(s.sortedTools(r.toolResults).filter(t => t.isBest || t.isWorst).map(t => t.tool)).toEqual(["perplexity", "gemini"]);
    expect(s.sortedLeaderboard(r.leaderboard).find(e => e.isClient)?.rank).toBe(4);
    expect(s.sortedChecks(r.websiteChecks).map(c => c.status)).toEqual(["fail", "fail", "warn", "pass", "pass"]);
    expect(s.actionsFor("visibility", r).map(a => a.id)).toEqual(["a2", "a7", "a8"]);
    expect(s.actionsFor("master", r).map(a => a.id)).toEqual(["a1", "a2", "a3", "a4", "a5", "a6"]);
    expect(r.toolResults.reduce((a, t) => a + t.named, 0)).toBe(r.leaderboard.find(e => e.isClient)?.count);
  });
});

describe("the four reports", () => {
  it("offers a summary, a recommendation report, a fact check and a full report of at most eight pages", () => {
    expect(s.VARIANT_INFO.map(v => v.key)).toEqual(["summary", "visibility", "factcheck", "master"]);
    expect(s.variantPages.summary).toHaveLength(1);
    expect(s.variantPages.master.length).toBeLessThanOrEqual(8);
    expect(s.pdfFileName("harbor", "master", "2026-10-12")).toBe("harbor-full-report-2026-10-12.pdf");
    expect(s.pdfFileName("harbor", "factcheck", "2026-10-12")).toBe("harbor-fact-check-2026-10-12.pdf");
  });
  it("builds the two single-subject reports only from pages the full report has", () => {
    for (const v of ["visibility", "factcheck"] as const) {
      expect(s.isVariant(v)).toBe(true);
      for (const id of s.variantPages[v]) expect(s.variantPages.master).toContain(id);
    }
    expect(s.variantPages.visibility).not.toContain("wrong_facts");
    expect(s.variantPages.factcheck).toContain("wrong_facts");
    expect(s.isVariant("nonsense")).toBe(false);
  });
  it("gives each report's plan page only its own actions", () => {
    expect(s.planActions("master", r)).toEqual(r.actions);
    expect(s.planActions("visibility", r).every(a => a.track !== "facts")).toBe(true);
    expect(s.planActions("factcheck", r).every(a => a.track !== "visibility")).toBe(true);
    expect(s.planActions("visibility", r).map(a => a.id)).toEqual(s.actionsFor("visibility", r).map(a => a.id));
    expect(s.planActions("factcheck", r).length).toBeGreaterThan(0);
  });
  it("names the scores the way the reports do", () => {
    expect(s.plainScoreNames(r.scores.overall.explanation)).toBe("Overall = 70% Recommended by AI (29) + 30% Accuracy (70) = 41.");
  });
});

describe("componentPoints against the stored overall", () => {
  const comp = (id: "named_often" | "rank_high" | "tool_reach" | "accuracy", weight: number, score: number) =>
    ({ id, label: id, definition: "", weight, score, detail: "" });
  it("gives no points when the overall is 0, even with perfect facts", () => {
    const comps = [comp("named_often", 41, 0), comp("rank_high", 17, 0), comp("tool_reach", 12, 0), comp("accuracy", 30, 100)];
    expect(s.componentPoints(comps, 0)).toEqual([0, 0, 0, 0]);
  });
  it("scales down to a capped overall", () => {
    const comps = [comp("named_often", 41, 100), comp("rank_high", 17, 100), comp("tool_reach", 12, 100), comp("accuracy", 30, 60)];
    const pts = s.componentPoints(comps, 70);
    expect(pts.reduce((a, b) => a + b, 0)).toBe(70);
  });
  it("absorbs a one-point rounding gap", () => {
    const comps = [comp("named_often", 41, 13), comp("rank_high", 17, 32), comp("tool_reach", 12, 80), comp("accuracy", 30, 70)];
    expect(s.componentPoints(comps, 42).reduce((a, b) => a + b, 0)).toBe(42);
    expect(s.componentPoints(comps, 40).reduce((a, b) => a + b, 0)).toBe(40);
  });
});
