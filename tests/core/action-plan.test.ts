import { describe, it, expect } from "vitest";
import { buildActionPlan, type PlanCheck, type ActionPlanInput } from "@/core/action-plan";
import { buildSourcesReport } from "@/core/citations";
import { buildSearchReport } from "@/core/search-queries";
import type { WebsiteCheckResult } from "@/core/website-check";

const ME = "Sweet Rise Bakery";
const HONEY = "Honey Crumb Cake Studio";
const HILL = "Hillcrest Bakery";
const PIER = "Pier Pastry";

let n = 0;
function check(p: Partial<PlanCheck> & { promptId: string }): PlanCheck {
  n++;
  const competitors = p.competitorsMentioned ?? [];
  const mentioned = p.mentioned ?? false;
  return {
    promptText: `Question ${p.promptId}`,
    promptKind: "category",
    engine: "openai",
    mentioned,
    competitorsMentioned: competitors,
    namedOrder: p.namedOrder ?? (mentioned ? [...competitors, ME] : competitors),
    citations: [],
    searchQueries: [],
    tone: null,
    toneReason: null,
    answerText: `Answer ${n}`,
    ...p,
  };
}

const site: WebsiteCheckResult = {
  checkedAt: "2026-10-20T00:00:00Z",
  checks: [
    { id: "ai_allowed", label: "AI assistants can read your site", why: "Your robots.txt blocks GPTBot.", status: "fail" },
    { id: "sitemap", label: "Sitemap", why: "No sitemap found.", status: "warn" },
    { id: "contact_visible", label: "Contact details", why: "Fine.", status: "pass" },
  ],
  pages: [{ url: "https://sweetrise.example/", title: "Home" }],
  homepageText: "fresh bread and cakes daily",
};

function fixture(): PlanCheck[] {
  const checks: PlanCheck[] = [];
  // q1: "best birthday cake" - lost; competitors only, cited yelp + cakeblog.
  for (let i = 0; i < 4; i++) checks.push(check({
    promptId: "q1", promptText: "Best birthday cake in Pasadena",
    competitorsMentioned: i < 3 ? [HONEY, HILL] : [HONEY],
    citations: ["https://www.yelp.com/biz/honey", "https://cakeblog.example/best-cakes"],
    searchQueries: ["best birthday cake pasadena prices", "birthday cake pasadena reviews"],
  }));
  // q2: closest call - named in 1 of 4, ranked 2nd once.
  for (let i = 0; i < 4; i++) checks.push(check({
    promptId: "q2", promptText: "Gluten-free bakery near Pasadena", engine: "anthropic",
    mentioned: i === 0, competitorsMentioned: [HILL],
    namedOrder: i === 0 ? [HILL, ME] : [HILL],
    citations: ["https://yelp.com/search", "https://reddit.com/r/pasadena/x"],
    searchQueries: ["gluten free bakery pasadena hours"],
    tone: i === 0 ? "mixed" : null,
    toneReason: i === 0 ? "Says the line is long on weekends." : null,
    answerText: i === 0 ? "Hillcrest Bakery is best. Sweet Rise Bakery is good but the line is long on weekends." : "Hillcrest Bakery.",
  }));
  // q3: lost on 2 of 2, competitors in only one answer (fewer than q1).
  checks.push(check({ promptId: "q3", promptText: "Wedding cake bakers", competitorsMentioned: ["Rosewood Cakes"], citations: ["https://theknot.com/x"] }));
  checks.push(check({ promptId: "q3", promptText: "Wedding cake bakers", competitorsMentioned: [] }));
  // q4: won - named in all answers; not an item.
  for (let i = 0; i < 2; i++) checks.push(check({
    promptId: "q4", promptText: "Sourdough in Pasadena", mentioned: true, competitorsMentioned: [HONEY],
    tone: "positive", citations: ["https://sweetrise.example/sourdough"],
  }));
  // Branded: must not count anywhere.
  for (let i = 0; i < 3; i++) checks.push(check({
    promptId: "b1", promptText: "Is Sweet Rise Bakery good?", promptKind: "branded",
    mentioned: true, competitorsMentioned: [PIER], citations: ["https://brandedonly.example/x"],
    tone: "negative", toneReason: "Branded complaint", searchQueries: ["sweet rise bakery wholesale"],
  }));
  return checks;
}

function input(checks = fixture(), overrides: Partial<ActionPlanInput> = {}): ActionPlanInput {
  return {
    checks,
    sources: buildSourcesReport(checks, "https://sweetrise.example"),
    search: buildSearchReport(checks),
    websiteCheck: site,
    website: "https://sweetrise.example",
    names: [ME],
    ...overrides,
  };
}

const items = (plan: ReturnType<typeof buildActionPlan>, key: string) =>
  plan.groups.find(g => g.key === key)?.items ?? [];

describe("buildActionPlan", () => {
  it("lists the groups in order, leaving empty ones out", () => {
    const plan = buildActionPlan(input());
    expect(plan.groups.map(g => g.key)).toEqual(["sources", "questions", "pages", "website", "reputation"]);
    expect(plan.total).toBe(plan.groups.reduce((s, g) => s + g.items.length, 0));
    expect(plan.quickWins).toBe(plan.groups.flatMap(g => g.items).filter(i => i.effort === "low" && i.impact === "high").length);
    const noTone = buildActionPlan(input(fixture().map(c => ({ ...c, tone: null }))));
    expect(noTone.groups.map(g => g.key)).not.toContain("reputation");
    expect(buildActionPlan(input([], { websiteCheck: null })).groups).toEqual([]);
  });

  it("names the competitors AI named from each source, with counts", () => {
    const sources = items(buildActionPlan(input()), "sources");
    const yelp = sources.find(i => i.key === "source:yelp.com")!;
    expect(yelp.title).toBe("Get on yelp.com");
    // yelp: 4 q1 answers + 3 q2 answers without the business = 7.
    expect(yelp.why).toBe(`AI read yelp.com in 7 answers and named ${HILL} (6) and ${HONEY} (4) from it, not you.`);
    expect(yelp.how).toMatch(/claim/i);
    expect(sources.find(i => i.key === "source:cakeblog.example")!.how).toMatch(/pitch/i);
    expect(sources.find(i => i.key === "source:reddit.com")!.how).toMatch(/post/i);
    expect(sources.some(i => i.key === "source:sweetrise.example")).toBe(false);
  });

  it("counts spelling variants of one competitor together on a source", () => {
    const checks = [
      check({ promptId: "x", competitorsMentioned: ["Hillcrest Bakery"], citations: ["https://yelp.com/a"] }),
      check({ promptId: "x", competitorsMentioned: ["Hillcrest Bakery (Pasadena)"], citations: ["https://yelp.com/b"] }),
      check({ promptId: "x", competitorsMentioned: ["hillcrest bakery", "Hillcrest Bakery"], citations: ["https://yelp.com/c"] }),
    ];
    const [yelp] = items(buildActionPlan(input(checks)), "sources");
    expect(yelp.why).toBe("AI read yelp.com in 3 answers and named Hillcrest Bakery (3) from it, not you.");
  });

  it("orders questions closest call first, then by answers naming a competitor", () => {
    const qs = items(buildActionPlan(input()), "questions");
    expect(qs.map(i => i.key)).toEqual(["question:q2", "question:q1", "question:q3"]);
    expect(qs[0].title).toBe("“Gluten-free bakery near Pasadena”");
    expect(qs[0].why).toBe(`AI named ${HILL}; you were named in 1 of 4 answers.`);
    expect(qs[1].why).toBe(`AI named ${HONEY} and ${HILL}; you were named in 0 of 4 answers.`);
    expect(qs[1].how).toContain("yelp.com");
    expect(qs[1].how).toContain("cakeblog.example");
    expect(qs.some(i => i.key === "question:q4" || i.key === "question:b1")).toBe(false);
  });

  it("adds pages AI searched for that the site lacks, quoting the searches", () => {
    const pages = items(buildActionPlan(input()), "pages");
    const prices = pages.find(i => i.key === "page:a-current-price-list")!;
    expect(prices.title).toBe("Add a current price list");
    expect(prices.why).toContain("“best birthday cake pasadena prices”");
    expect(pages.some(i => i.why.includes("wholesale"))).toBe(false);
  });

  it("lists failing website checks with today's titles and the check's why", () => {
    const site = items(buildActionPlan(input()), "website");
    expect(site.map(i => i.key)).toEqual(["site:ai_allowed", "site:sitemap"]);
    expect(site[0]).toMatchObject({ title: "Let AI assistants read your site", why: "Your robots.txt blocks GPTBot.", effort: "low", impact: "high" });
  });

  it("summarises caveats from buyer answers only, with a short quote", () => {
    const [rep] = items(buildActionPlan(input()), "reputation");
    expect(rep.key).toBe("reputation:caveats");
    expect(rep.why).toContain("1 answer");
    expect(rep.evidence).toHaveLength(1);
    expect(rep.evidence[0]).toContain("line is long on weekends");
    expect(rep.evidence.join(" ")).not.toContain("Branded complaint");
  });

  it("never counts branded questions", () => {
    const plan = buildActionPlan(input());
    const text = JSON.stringify(plan);
    expect(text).not.toContain("brandedonly.example");
    expect(text).not.toContain(PIER + " (");
    expect(text).not.toContain("Is Sweet Rise Bakery good?");
  });

  it("has no fact or price-correction items", () => {
    const plan = buildActionPlan(input());
    const all = plan.groups.flatMap(g => g.items);
    expect(all.some(i => /fact|wrong price/i.test(i.title) || i.key.startsWith("fact"))).toBe(false);
  });

  it("keeps keys stable across two builds and new scans of the same things", () => {
    const a = buildActionPlan(input()).groups.flatMap(g => g.items.map(i => i.key));
    const reshuffled = fixture().reverse().map(c => ({ ...c, answerText: c.answerText + " again" }));
    const b = buildActionPlan(input(reshuffled)).groups.flatMap(g => g.items.map(i => i.key));
    expect(new Set(b)).toEqual(new Set(a));
    expect(new Set(a).size).toBe(a.length);
  });

  it("caps sources and questions at 8", () => {
    const checks: PlanCheck[] = [];
    for (let i = 0; i < 12; i++) checks.push(check({
      promptId: `p${i}`, competitorsMentioned: [HONEY], citations: [`https://site${i}.example/x`],
    }));
    const plan = buildActionPlan(input(checks));
    expect(items(plan, "sources")).toHaveLength(8);
    expect(items(plan, "questions")).toHaveLength(8);
  });

  it("sorts within a group by impact, then effort", () => {
    const plan = buildActionPlan(input());
    const impact = { high: 0, medium: 1, low: 2 };
    const effort = { low: 0, medium: 1, high: 2 };
    for (const g of plan.groups) {
      const w = g.items.map(i => impact[i.impact] * 3 + effort[i.effort]);
      expect([...w].sort((x, y) => x - y)).toEqual(w);
    }
  });
});
