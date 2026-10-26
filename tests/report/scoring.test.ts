import { describe, it, expect } from "vitest";
import sample from "@/report/sample-audit.json";
import type { AuditReport } from "@/report/types";
import * as s from "@/report/scoring";
import { shownScore } from "@/core/scoring";

// The design kit's own sanity checks against its sample data, kept passing.
const r = sample as unknown as AuditReport;

describe("design kit scoring (sample data)", () => {
  it("matches the sample's scores", () => {
    expect(s.overallScore(r.scores.components)).toBe(r.scores.overall.value);
    expect(s.visibilityScore(r.scores.components)).toBe(r.scores.visibility);
    expect(s.componentPoints(r.scores.components)).toEqual([4, 4, 6, 15]);
    expect(shownScore(s.factAccuracy(r.facts))).toBe(r.scores.factAccuracy);
    expect(r.scores.components.reduce((a, c) => a + c.weight, s.STARTING_POINTS)).toBe(100);
  });
  it("bands a shown score where the raw score's band was", () => {
    // Raw 70 and 40 are the bars; shown, they are 79 and 58.
    expect([30, 57, 58, 78, 79, 100].map(s.scoreBand)).toEqual(["needs_work", "needs_work", "fair", "fair", "strong", "strong"]);
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
    expect(s.plainScoreNames(r.scores.overall.explanation)).toBe("Overall = 70% Recommended by AI (50) + 30% Accuracy (79) = 59.");
  });
});

describe("componentPoints against the stored overall", () => {
  const comp = (id: "named_often" | "rank_high" | "tool_reach" | "accuracy", weight: number, score: number) =>
    ({ id, label: id, definition: "", weight, score, detail: "" });
  it("gives no points beyond the starting 30 when the overall is 30, even with perfect facts", () => {
    const comps = [comp("named_often", 29, 0), comp("rank_high", 12, 0), comp("tool_reach", 8, 0), comp("accuracy", 21, 100)];
    expect(s.componentPoints(comps, 30)).toEqual([0, 0, 0, 0]);
  });
  it("scales down to a capped overall", () => {
    const comps = [comp("named_often", 29, 100), comp("rank_high", 12, 100), comp("tool_reach", 8, 100), comp("accuracy", 21, 60)];
    const pts = s.componentPoints(comps, 79);
    expect(pts.reduce((a, b) => a + b, 0)).toBe(49);
  });
  it("absorbs a one-point rounding gap", () => {
    const comps = [comp("named_often", 29, 13), comp("rank_high", 12, 32), comp("tool_reach", 8, 80), comp("accuracy", 21, 70)];
    expect(s.componentPoints(comps, 60).reduce((a, b) => a + b, 0)).toBe(30);
    expect(s.componentPoints(comps, 58).reduce((a, b) => a + b, 0)).toBe(28);
  });
});
