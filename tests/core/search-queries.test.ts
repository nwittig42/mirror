import { describe, it, expect } from "vitest";
import { buildSearchReport } from "@/core/search-queries";

const check = (over: Partial<Parameters<typeof buildSearchReport>[0][number]>) => ({
  promptKind: "category", engine: "openai", mentioned: false, competitorsMentioned: [], searchQueries: [],
  promptText: "Best med spa in Santa Monica", ...over,
});

describe("buildSearchReport", () => {
  it("counts queries per answer, tracks engines and competitor-only answers, skips branded", () => {
    const r = buildSearchReport([
      check({ searchQueries: ["Best med spa Santa Monica reviews", "med spa santa monica 2026"], mentioned: true }),
      check({ engine: "gemini", searchQueries: ["best med spa santa monica reviews"], competitorsMentioned: ["Skin Bar"] }),
      check({ searchQueries: [] }),
      check({ promptKind: "branded", searchQueries: ["glow medspa price"] }),
    ]);
    expect(r.answersWithSearches).toBe(2);
    expect(r.searchesPerAnswer).toBe(1.5);
    expect(r.queries[0]).toEqual({
      query: "best med spa santa monica reviews", answers: 2, engines: ["openai", "gemini"], competitorOnly: 1,
    });
    expect(r.queries.some(q => q.query.includes("glow"))).toBe(false);
  });

  it("finds the words engines add beyond the question", () => {
    const r = buildSearchReport([
      check({ searchQueries: ["med spa santa monica reviews 2026"] }),
      check({ searchQueries: ["santa monica med spa reviews"] }),
    ]);
    expect(r.addedWords.slice(0, 2)).toEqual([{ word: "reviews", answers: 2 }, { word: "2026", answers: 1 }]);
  });
});
