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
    expect(s.sortedChecks(r.websiteChecks).map(c => c.status)).toEqual(["fail", "fail", "fail", "warn", "warn", "pass", "pass"]);
    expect(s.actionsFor("visibility", r).map(a => a.id)).toEqual(["a2", "a4", "a6", "a9", "a10"]);
    expect(s.actionsFor("factcheck", r).map(a => a.id)).toEqual(["a1", "a3", "a4", "a5", "a6", "a7", "a8"]);
    expect(r.toolResults.reduce((a, t) => a + t.named, 0)).toBe(r.leaderboard.find(e => e.isClient)?.count);
  });
});

describe("the Harbor Plumbing demo", () => {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const clientCount = r.leaderboard.find(e => e.isClient)!.count;

  it("is a plumber in Portland, written without the old aesthetic-practice words", () => {
    expect(r.business).toEqual({ name: "Harbor Plumbing and Drain", website: "harborplumbingpdx.com", location: "Portland, OR", category: "Plumber" });
    expect(JSON.stringify(r)).not.toMatch(/patient|practice|provider|treatment|med ?spa|botox|injector/i);
    expect(JSON.stringify(r)).not.toContain("\u2014");
    for (const q of r.questions) expect(q.text).not.toMatch(/near me/i);
  });

  it("runs all seven website checks, with a fix on every one that did not pass", () => {
    expect(r.websiteChecks.map(c => c.id)).toEqual([
      "ai_allowed", "readable_text", "facts_page", "machine_labels", "sitemap", "business_schema", "contact_visible",
    ]);
    for (const c of r.websiteChecks.filter(c => c.status !== "pass")) expect(c.fix).toBeTruthy();
  });

  it("keeps every count consistent", () => {
    expect(sum(r.scores.components.map(c => c.weight))).toBe(100);
    for (const t of r.toolResults) expect(t.total).toBe(r.scan.buyerQuestionCount * r.scan.runsPerQuestion);
    // The grid, the tool cards, the leaderboard and the tone donut all count the same answers.
    expect(sum(r.questions.flatMap(q => q.cells.map(c => c.runsAppeared)))).toBe(clientCount);
    for (const t of r.toolResults) {
      expect(sum(r.questions.map(q => q.cells.find(c => c.tool === t.tool)!.runsAppeared))).toBe(t.named);
    }
    expect(sum(Object.values(r.tone))).toBe(clientCount);
    expect(sum(r.sources.types.map(t => t.pct))).toBe(100);
    for (const w of r.closestWins) {
      expect(r.questions.find(q => q.id === w.questionId)!.cells.find(c => c.tool === w.tool)!.clientRank).toBe(w.rank);
    }
    expect(r.topFixIds.every(id => r.actions.some(a => a.id === id))).toBe(true);
  });

  it("checks a licence, a service it does not offer, a price, hours and an address", () => {
    const topics = r.facts.map(f => f.topic.toLowerCase());
    expect(topics).toContain("license");
    expect(topics).toContain("address");
    expect(topics).toContain("hours");
    expect(r.facts.some(f => f.isPrice)).toBe(true);
    expect(r.facts.some(f => !f.isTrue && f.truth === "Not offered.")).toBe(true);
  });

  // Review finding: the seed and the landing card put 24/7 emergency service
  // on this business's not-offered list, while the sample report confirmed
  // "Weekend emergency service: Yes, Saturday and Sunday" and quoted AI
  // praising its "weekend emergency calls". The same fictional business
  // cannot both offer and not offer it.
  it("never confirms emergency service, which the seed puts on the not-offered list", () => {
    for (const f of r.facts) {
      expect(f.topic).not.toMatch(/emergency/i);
      // A confirmed fact may say the line does not exist, never that it does.
      if (f.isTrue) expect(f.truth).not.toMatch(/\b(yes|offers|available)\b[^.]*emergency/i);
    }
    const sameDay = r.facts.find(f => f.topic === "Same-day service");
    expect(sameDay).toMatchObject({ isTrue: true, truth: "Yes, weekdays and Saturdays. No 24/7 emergency line." });
    expect(r.quotes.best!.text).toContain("Saturday appointments");
    expect(r.quotes.best!.text).not.toMatch(/emergency/i);
    expect(r.quotes.worst!.text).not.toMatch(/emergency/i);
    for (const q of r.questions) expect(q.text).not.toMatch(/emergency/i);
    for (const s of r.searches.queries) expect(s.query).not.toMatch(/emergency/i);
    // The hours fact says what the seed's hours say, with no emergency line attached.
    expect(r.facts.find(f => f.topic === "Hours")).toMatchObject({ isTrue: false, truth: "Closed Sundays. Open Saturdays 8am to 2pm." });
  });

  it("uses the seed's address and licence number", () => {
    expect(r.facts.find(f => f.topic === "Address")!.truth).toBe("2140 SE Powell Blvd, Portland, OR 97202");
    expect(r.facts.find(f => f.topic === "License")!.truth).toContain("Oregon CCB #221467");
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
