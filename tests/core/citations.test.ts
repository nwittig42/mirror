import { describe, it, expect } from "vitest";
import { buildSourcesReport, classifyDomain, domainOf } from "@/core/citations";

const check = (over: Partial<Parameters<typeof buildSourcesReport>[0][number]>) => ({
  promptKind: "category", mentioned: false, competitorsMentioned: [], citations: [], ...over,
});

describe("domainOf", () => {
  it("strips www and lower-cases", () => {
    expect(domainOf("https://WWW.Yelp.com/biz/glow?x=1")).toBe("yelp.com");
  });
  it("rejects non-http and garbage", () => {
    expect(domainOf("javascript:alert(1)")).toBeNull();
    expect(domainOf("not a url")).toBeNull();
  });
});

describe("classifyDomain", () => {
  it("recognises the practice's own site, including subdomains", () => {
    expect(classifyDomain("book.glowmedspa.com", "glowmedspa.com")).toBe("own_site");
  });
  it("matches known domains on subdomains", () => {
    expect(classifyDomain("m.yelp.com", null)).toBe("reviews");
    expect(classifyDomain("en.wikipedia.org", null)).toBe("reference");
    expect(classifyDomain("old.reddit.com", null)).toBe("social");
  });
  it("does not match a lookalike suffix", () => {
    expect(classifyDomain("notyelp.com", null)).toBe("other");
  });
});

describe("buildSourcesReport", () => {
  it("counts per answer, ignores branded prompts, and finds competitor-only gaps", () => {
    const report = buildSourcesReport([
      check({ mentioned: true, citations: ["https://glowmedspa.com/", "https://yelp.com/a", "https://yelp.com/b"] }),
      check({ competitorsMentioned: ["Skin Bar"], citations: ["https://yelp.com/c", "https://latimes.com/best"] }),
      check({ competitorsMentioned: ["Skin Bar"], citations: ["https://latimes.com/best"] }),
      check({ citations: [] }),
      check({ promptKind: "branded", mentioned: true, citations: ["https://glowmedspa.com/pricing"] }),
    ], "https://www.glowmedspa.com");

    expect(report.totalAnswers).toBe(4);
    expect(report.answersWithSources).toBe(3);
    expect(report.ownSiteRate).toBeCloseTo(1 / 3);

    const yelp = report.sources.find(s => s.domain === "yelp.com")!;
    expect(yelp).toMatchObject({ kind: "reviews", answers: 2, namedYou: 1, competitorOnly: 1 });
    expect(report.sources[0].domain).toBe("latimes.com"); // 2 answers, alphabetical tie-break with yelp

    expect(report.gaps.map(g => g.domain)).toEqual(["latimes.com", "yelp.com"]);
    expect(report.gaps.some(g => g.kind === "own_site")).toBe(false);
  });

  it("accepts a website with no scheme", () => {
    const report = buildSourcesReport([check({ mentioned: true, citations: ["https://glow.example/x"] })], "glow.example");
    expect(report.sources[0].kind).toBe("own_site");
  });

  it("handles a scan with no citations at all", () => {
    const report = buildSourcesReport([check({})], null);
    expect(report).toMatchObject({ totalAnswers: 1, answersWithSources: 0, ownSiteRate: 0, sources: [], gaps: [] });
  });
});
