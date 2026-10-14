import { describe, it, expect } from "vitest";
import { FIXED_BY, FORECAST_MONTHS, fixSource, forecastAccuracy, pointsFor, type FixSource, type WrongFact } from "@/core/accuracy-forecast";
import { competitorScore, forecastScores } from "@/core/score-forecast";

const wrong = (over: Partial<WrongFact> = {}): WrongFact => ({ label: "Call-out fee", severity: "major", category: "pricing", source: "own_site", ...over });

describe("fixSource", () => {
  it("sorts a wrong fact by the pages AI cited, the business's own site first", () => {
    expect(fixSource(["https://www.yelp.com/biz/harbor", "https://harbor.example/prices"], "harbor.example")).toBe("own_site");
    expect(fixSource(["https://www.yelp.com/biz/harbor", "https://oldnews.example/story"], "https://harbor.example")).toBe("listing");
    expect(fixSource(["https://oldnews.example/story"], "https://harbor.example")).toBe("elsewhere");
    expect(fixSource([], "https://harbor.example")).toBe("memory");
    expect(fixSource(["not a url"], null)).toBe("memory");
  });
});

describe("the chances", () => {
  it("never fall over time, keep low under likely under high, and rank the sources by how much the business controls", () => {
    for (const source of Object.keys(FIXED_BY) as FixSource[]) {
      let before = 0;
      for (const month of FORECAST_MONTHS) {
        const r = FIXED_BY[source][month];
        expect(r.low).toBeLessThan(r.likely);
        expect(r.likely).toBeLessThan(r.high);
        expect(r.high).toBeLessThan(1);
        expect(r.likely).toBeGreaterThan(before);
        before = r.likely;
      }
    }
    expect(FIXED_BY.own_site[3].likely).toBeGreaterThan(FIXED_BY.listing[3].likely);
    expect(FIXED_BY.listing[3].likely).toBeGreaterThan(FIXED_BY.elsewhere[3].likely);
    expect(FIXED_BY.elsewhere[3].likely).toBeGreaterThan(FIXED_BY.memory[3].likely);
    // By the end of the year a retrained model has likely read the corrected page; a page nobody fixes keeps saying it.
    expect(FIXED_BY.memory[12].likely).toBeGreaterThan(FIXED_BY.elsewhere[12].likely);
  });
});

describe("forecastAccuracy", () => {
  it("starts from the score the scan gave and returns each wrong fact's points by its chance of being gone", () => {
    // A price (12 x 1.5 = 18) read on their own site and a minor fact (4) with no source: 100 - 22 = 78 today.
    const f = forecastAccuracy({ judgedChecks: 10, wrong: [wrong(), wrong({ label: "Sunday hours", severity: "minor", category: "logistics", source: "memory" })] })!;
    expect(f.now).toBe(78);
    expect(pointsFor(wrong())).toBe(18);
    // 3 months, likely: 18 x (1 - 0.75) + 4 x (1 - 0.15) = 7.9 still lost.
    expect(f.points.map(p => p.month)).toEqual([3, 6, 9, 12]);
    expect(f.points[0]).toEqual({ month: 3, low: 89, likely: 92, high: 94 });
    // 12 months, likely: 18 x 0.1 + 4 x 0.45 = 3.6 still lost.
    expect(f.points[3].likely).toBe(96);
    expect(f.best).toBe(100);
    expect(f.facts.map(x => [x.label, x.points])).toEqual([["Call-out fee", 18], ["Sunday hours", 4]]);
    expect(f.bySource).toEqual([{ source: "own_site", count: 1, points: 18 }, { source: "memory", count: 1, points: 4 }]);
  });

  it("only ever rises, and stays between low and high", () => {
    const f = forecastAccuracy({ judgedChecks: 5, wrong: [wrong(), wrong({ source: "listing" }), wrong({ severity: "critical", category: "identity", source: "elsewhere" })] })!;
    let before = f.now;
    for (const p of f.points) {
      expect(p.likely).toBeGreaterThanOrEqual(before);
      expect(p.low).toBeLessThanOrEqual(p.likely);
      expect(p.high).toBeGreaterThanOrEqual(p.likely);
      before = p.likely;
    }
  });

  it("stays at 0 while more points are lost than the score has, however many fixes land", () => {
    // Six serious wrong facts with no source cost 150 points; three months on, over 100 are still lost.
    const f = forecastAccuracy({ judgedChecks: 5, wrong: Array.from({ length: 6 }, () => wrong({ severity: "critical", category: "identity", source: "memory" })) })!;
    expect(f.now).toBe(0);
    expect(f.points[0].likely).toBe(0);
    // By 12 months more than half are expected gone: 150 x 0.45 = 67.5 lost.
    expect(f.points[3].likely).toBe(33);
  });

  it("has nothing to forecast when no facts were checked or none was wrong", () => {
    expect(forecastAccuracy({ judgedChecks: 0, wrong: [wrong()] })).toBeNull();
    expect(forecastAccuracy({ judgedChecks: 5, wrong: [] })).toBeNull();
  });
});

describe("the three score lines", () => {
  const check = (engine: string, competitors: string[], order: string[] = competitors, promptKind: "category" | "branded" = "category") =>
    ({ engine, promptKind, competitorsMentioned: competitors, namedOrder: order });

  it("scores the competitor from the same answers, by how often and how high it is named", () => {
    // Named in every answer, always first, by the only tool: a perfect score.
    expect(competitorScore([check("openai", ["A"]), check("openai", ["A", "B"])], "A")).toBe(100);
    // Never named: zero, as for the business itself.
    expect(competitorScore([check("openai", ["B"])], "A")).toBe(0);
    // Named in half the answers, second: 50% x 0.5 + 20% x 0.35 + 15% x 1, over 0.85.
    expect(competitorScore([check("openai", ["B", "A"]), check("openai", ["B"])], "A")).toBe(55);
  });

  it("raises Recommended by AI toward the competitor at the assumed pace, and Overall with both", () => {
    const accuracy = forecastAccuracy({ judgedChecks: 5, wrong: [wrong()] })!;
    const f = forecastScores({ now: { facts: 82, visibility: 20 }, accuracy, target: 72 });
    // A 52 point gap closed over 12 months: a quarter of it every 3 months. Twice as fast is there by month 6; twice as slow gets half way.
    expect(f.visibility).toEqual({ now: 20, points: [
      { month: 3, low: 27, likely: 33, high: 46 }, { month: 6, low: 33, likely: 46, high: 72 },
      { month: 9, low: 40, likely: 59, high: 72 }, { month: 12, low: 46, likely: 72, high: 72 },
    ] });
    expect(f.facts!.points[0].likely).toBe(96);
    // 70% x 20 + 30% x 82 = 38.6 today; 70% x 33 + 30% x 96 = 51.9 in 3 months; 70% x 72 + 30% x 98 = 79.8 in 12.
    expect(f.overall!.now).toBe(39);
    expect(f.overall!.points[0].likely).toBe(52);
    expect(f.overall!.points[3].likely).toBe(80);
  });

  it("keeps a score level when there is nothing to change it", () => {
    const f = forecastScores({ now: { facts: 100, visibility: 60 }, accuracy: null, target: 40 });
    expect(f.facts!.points.map(p => p.likely)).toEqual([100, 100, 100, 100]);
    expect(f.visibility!.points.every(p => p.low === 60 && p.likely === 60 && p.high === 60)).toBe(true);
    expect(forecastScores({ now: { facts: null, visibility: 30 }, accuracy: null, target: null }).facts).toBeNull();
    expect(forecastScores({ now: { facts: 80, visibility: null }, accuracy: null, target: 50 })).toMatchObject({ visibility: null, overall: null });
  });

  it("holds Overall at 70 while a serious wrong fact is still likely around, then lets it go", () => {
    // Read on a page nobody can edit: it is more likely still there than gone all year, except at the hopeful end.
    const accuracy = forecastAccuracy({ judgedChecks: 5, wrong: [wrong({ severity: "critical", category: "identity", source: "elsewhere" })] })!;
    const f = forecastScores({ now: { facts: 75, visibility: 90 }, accuracy, target: 90 });
    // 70% x 90 + 30% x 75 = 85.5, capped.
    expect(f.overall!.now).toBe(70);
    expect(f.overall!.points[3].likely).toBe(70);
    // High end at 12 months: a 60% chance it is gone counts as lifted. 63 + 30% x 90 = 90.
    expect(f.overall!.points[3].high).toBe(90);
  });
});
