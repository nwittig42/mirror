import { describe, it, expect } from "vitest";
import { buildActionPlan, sitesToGetOn, type PlanCheck, type ActionPlanInput } from "@/core/action-plan";
import { buildSourcesReport, classifyDomain } from "@/core/citations";
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

  it("says who AI named alongside a site it read, never that it named them from it", () => {
    const sources = items(buildActionPlan(input()), "sources");
    const blog = sources.find(i => i.key === "source:cakeblog.example")!;
    expect(blog.title).toBe("Get on cakeblog.example");
    expect(blog.why).toBe(`In 4 answers that left you out, AI read cakeblog.example and named ${HONEY} (4) and ${HILL} (3).`);
    expect(blog.how).toMatch(/pitch/i);
    // The page AI actually read, from the answers it lost.
    expect(blog.evidence[0]).toBe("https://cakeblog.example/best-cakes");
    expect(JSON.stringify(sources)).not.toContain("from it");
  });

  it("says stand out, not get on, for a site whose answers already named the business", () => {
    const sources = items(buildActionPlan(input()), "sources");
    const yelp = sources.find(i => i.key === "source:yelp.com")!;
    // yelp: 8 answers read it; q2's first named the business; 4 q1 + 3 q2 left it out.
    expect(yelp.title).toBe("Stand out on yelp.com");
    expect(yelp.why).toBe(`AI read yelp.com in 8 answers. It named you in 1, but in 7 it named ${HILL} and ${HONEY} and not you.`);
    expect(yelp.how.startsWith("You're already on this site. Find the page AI read that leaves you out (below) and ask its writer to add you.")).toBe(true);
    expect(yelp.how).toMatch(/claim/i);
    // The two pages read most in the lost answers, most first.
    expect(yelp.evidence.slice(0, 2)).toEqual(["https://www.yelp.com/biz/honey", "https://yelp.com/search"]);
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
    expect(yelp.why).toBe("In 3 answers that left you out, AI read yelp.com and named Hillcrest Bakery (3).");
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
    // Never the check's passing phrase ("AI assistants can read your site") as proof of a failure.
    expect(site.every(i => i.evidence.length === 0)).toBe(true);
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
    // Sources keep the data's order (biggest gap first); see below.
    for (const g of plan.groups.filter(g => g.key !== "sources")) {
      const w = g.items.map(i => impact[i.impact] * 3 + effort[i.effort]);
      expect([...w].sort((x, y) => x - y)).toEqual(w);
    }
  });

  it("keeps sources biggest gap first, with impact from the data", () => {
    const sources = items(buildActionPlan(input()), "sources");
    expect(sources.map(i => i.key)).toEqual(["source:yelp.com", "source:cakeblog.example", "source:reddit.com", "source:theknot.com"]);
    // Top 3 are high; theknot.com is 1 of 12 buyer answers, under a quarter.
    expect(sources.map(i => i.impact)).toEqual(["high", "high", "high", "medium"]);
    const big: PlanCheck[] = [];
    for (let i = 0; i < 5; i++) big.push(check({ promptId: `s${i}`, competitorsMentioned: [HONEY], citations: [`https://s${i}.example/x`] }));
    for (let i = 0; i < 3; i++) big.push(check({ promptId: "w", competitorsMentioned: [HONEY], citations: ["https://wide.example/x"] }));
    for (let i = 0; i < 4; i++) big.push(check({ promptId: "won", mentioned: true }));
    // wide.example: 3 of 12 buyer answers is a quarter, so high though it's 1st anyway; s0..s4 are 1 each.
    const bigItems = items(buildActionPlan(input(big)), "sources");
    expect(bigItems[0]).toMatchObject({ key: "source:wide.example", impact: "high" });
    expect(bigItems.slice(3).every(i => i.impact === "medium")).toBe(true);
  });

  it("leaves out a competitor's own website", () => {
    const checks = [
      check({ promptId: "x", competitorsMentioned: [HILL], citations: ["https://www.hillcrestbakery.com/menu", "https://yelp.com/a"] }),
      check({ promptId: "x", competitorsMentioned: [HONEY], citations: ["https://honeycrumb.com/"] }),
      check({ promptId: "x", competitorsMentioned: ["Rose & Thorn Bakehouse"], citations: ["https://rose-thorn-bakehouse.net/"] }),
    ];
    const keys = items(buildActionPlan(input(checks)), "sources").map(i => i.key);
    expect(keys).toEqual(["source:yelp.com"]);
  });

  it("doesn't claim the site lacks a page when it wasn't checked or partly has it", () => {
    const unchecked = items(buildActionPlan(input(fixture(), { websiteCheck: null })), "pages");
    const prices = unchecked.find(i => i.key === "page:a-current-price-list")!;
    expect(prices.why).toBe("AI searched for \u201cbest birthday cake pasadena prices\u201d before answering. Make sure your site covers it.");
    const partSite = { ...site, homepageText: "see our prices in store" };
    const partial = items(buildActionPlan(input(fixture(), { websiteCheck: partSite })), "pages")
      .find(i => i.key === "page:a-current-price-list")!;
    expect(partial.why).toBe("AI searched for \u201cbest birthday cake pasadena prices\u201d before answering, and your site doesn't give it its own page.");
    expect(items(buildActionPlan(input()), "pages").find(i => i.key === "page:a-current-price-list")!.why)
      .toContain("your site doesn't have this");
  });

  it("says \"gives\" for one caveat and \"repeats\" for two or more", () => {
    expect(items(buildActionPlan(input()), "reputation")[0].title).toBe("Answer the caveat AI gives");
    const two = fixture().map(c => c.promptId === "q4" ? { ...c, tone: "mixed", toneReason: "Pricey." } : c);
    expect(items(buildActionPlan(input(two)), "reputation")[0].title).toBe("Answer the caveat AI repeats");
  });

  it("quotes AI's reason for the caveat, without markdown, under a plain title", () => {
    const c = check({
      promptId: "t", mentioned: true, tone: "mixed", toneReason: `  **Pricey**, and the line is ${"long ".repeat(60)}`,
      competitorsMentioned: [HILL], answerText: "Sweet Rise Bakery is **great** but slow on weekends.",
    });
    const plan = buildActionPlan(input([c]));
    const [rep] = items(plan, "reputation");
    expect(rep.evidence).toHaveLength(1);
    expect(rep.evidence[0].startsWith("\u201cPricey, and the line is long")).toBe(true);
    expect(rep.evidence[0]).not.toContain("**");
    expect(rep.evidence[0]).not.toContain("slow on weekends");
    expect(rep.evidence[0].length).toBeLessThanOrEqual(203);
    // Cut at a word, never mid-word.
    expect(rep.evidence[0].endsWith("long…\u201d")).toBe(true);
    const group = plan.groups.find(g => g.key === "reputation")!;
    expect(group.title).toBe("Answer the \"but\" in AI's answers");
    expect(group.intro).toBe("Answers where AI named you, then added a \"but\". Here's what it said.");
  });

  it("suggests a question's domains only from answers that left the business out", () => {
    const checks = [
      check({ promptId: "z", promptText: "Cupcakes", mentioned: false, competitorsMentioned: [HONEY], citations: ["https://lost.example/a"] }),
      check({ promptId: "z", promptText: "Cupcakes", mentioned: false, competitorsMentioned: [HONEY], citations: ["https://lost.example/b"] }),
      check({ promptId: "z", promptText: "Cupcakes", mentioned: true, competitorsMentioned: [HONEY],
        citations: ["https://won1.example/a", "https://won2.example/b"] }),
      check({ promptId: "z", promptText: "Cupcakes", mentioned: false, competitorsMentioned: [], citations: ["https://empty.example/a"] }),
      check({ promptId: "z", promptText: "Cupcakes", mentioned: false, competitorsMentioned: [], citations: ["https://empty.example/a"] }),
    ];
    const [q] = items(buildActionPlan(input(checks)), "questions");
    expect(q.how).toContain("lost.example");
    expect(q.how).not.toMatch(/won1|won2|empty/);
  });

  it("keeps a bigger gap above an easier one in sources", () => {
    const checks: PlanCheck[] = [];
    for (let i = 0; i < 3; i++) checks.push(check({ promptId: `b${i}`, competitorsMentioned: [HONEY], citations: ["https://cakeblog.example/x"] }));
    for (let i = 0; i < 2; i++) checks.push(check({ promptId: `y${i}`, competitorsMentioned: [HONEY], citations: ["https://yelp.com/x"] }));
    const sources = items(buildActionPlan(input(checks)), "sources");
    expect(sources.map(i => [i.key, i.effort, i.impact])).toEqual([
      ["source:cakeblog.example", "medium", "high"],
      ["source:yelp.com", "low", "high"],
    ]);
  });
});


describe("sitesToGetOn", () => {
  it("is the gaps in order, without competitors' own sites, each with who AI named from it", () => {
    const checks = [
      check({ promptId: "x", competitorsMentioned: [HILL, HONEY], citations: ["https://www.hillcrestbakery.com/menu", "https://yelp.com/a", "https://reddit.com/r/x"] }),
      check({ promptId: "y", competitorsMentioned: [HONEY], citations: ["https://yelp.com/b"] }),
      check({ promptId: "z", mentioned: true, competitorsMentioned: [PIER], citations: ["https://reddit.com/r/y"] }),
      check({ promptId: "b", promptKind: "branded", competitorsMentioned: [PIER], citations: ["https://brandedonly.example/x"] }),
    ];
    const sites = sitesToGetOn(buildSourcesReport(checks, "https://sweetrise.example"), checks);
    expect(sites.map(s => s.domain)).toEqual(["yelp.com", "reddit.com"]);
    expect(sites[0].named).toEqual([{ name: HONEY, count: 2 }, { name: HILL, count: 1 }]);
    // Only answers that left the business out: the answer naming it and Pier Pastry doesn't count.
    expect(sites[1].named.map(n => n.name)).toEqual([HILL, HONEY]);
  });
});


describe("action plan credibility", () => {
  const lost = (citations: string[], competitorsMentioned = [HONEY]) =>
    check({ promptId: `l${n}`, competitorsMentioned, citations });

  it("leaves out sites a small business can't get onto", () => {
    const blocked = [
      "https://en.wikipedia.org/wiki/Donut", "https://www.wikidata.org/x", "https://www.britannica.com/x",
      "https://www.portland.gov/permits", "https://www.oregon.gov/x", "https://pdx.edu/x",
      "https://openai.com/x", "https://chatgpt.com/x", "https://www.perplexity.ai/x", "https://anthropic.com/x",
      "https://claude.ai/x", "https://x.ai/x", "https://gemini.google.com/x",
      "https://apps.apple.com/us/app/x", "https://play.google.com/store/x", "https://chromewebstore.google.com/x",
      "https://bucket.s3.amazonaws.com/menu.pdf", "https://d1234.cloudfront.net/x", "https://cdn.shopify.com/x",
      "https://images.squarespace-cdn.com/x", "https://support.google.com/x", "https://news.google.com/x",
    ];
    const kept = ["https://google.com/maps/x", "https://yelp.com/a"];
    const checks = [...blocked, ...kept].map(u => lost([u]));
    const plan = buildActionPlan(input(checks));
    const keys = items(plan, "sources").map(i => i.key);
    expect(keys.sort()).toEqual(["source:google.com", "source:yelp.com"]);
    const sites = sitesToGetOn(buildSourcesReport(checks, "https://sweetrise.example"), checks).map(s => s.domain);
    expect(sites.sort()).toEqual(["google.com", "yelp.com"]);
  });

  it("keeps Google's own map and business sites, as one Google Business Profile step", () => {
    const checks = [lost(["https://google.com/maps/x"]), lost(["https://maps.google.com/x"]), lost(["https://business.google.com/x"])];
    const sources = items(buildActionPlan(input(checks)), "sources");
    expect(sources).toHaveLength(1);
    expect(sources[0].title).toBe("Complete your Google Business Profile");
    expect(sources.some(i => /Get on .*google/.test(i.title))).toBe(false);
  });

  it("treats national and local press as a pitch, not a listing", () => {
    for (const host of ["bonappetit.com", "portland.eater.com", "www.usatoday.com", "eu.usatoday.com", "oregonlive.com",
      "infatuation.com", "cntraveler.com", "foodandwine.com", "kgw-news.com", "pdxtimes.com", "local.news.example"]) {
      expect(classifyDomain(host, null), host).toBe("press");
    }
    expect(classifyDomain("yelp.com", null)).toBe("reviews");
    const [press] = items(buildActionPlan(input([lost(["https://portland.eater.com/best-donuts"])])), "sources");
    expect(press.effort).toBe("high");
    expect(press.how).toBe("This is an article by a writer. You can't add yourself, but you can pitch: email the writer a short note on what makes you different, with a photo and a link.");
  });

  it("never suggests a competitor's own site or an unreachable one for a question", () => {
    const checks = [0, 1].map(() => check({
      promptId: "q", promptText: "Best donuts in Portland", competitorsMentioned: ["Doe Donuts", "Blue Star"],
      citations: ["https://doedonuts.com/", "https://order.bluestar.square.site/", "https://en.wikipedia.org/x", "https://yelp.com/a"],
    }));
    const [q] = items(buildActionPlan(input(checks)), "questions");
    expect(q.how).toContain("yelp.com");
    expect(q.how).not.toMatch(/doedonuts|bluestar|wikipedia/);
    expect(q.how).toBe("Add a page or section to your site that answers \u201cBest donuts in Portland\u201d in plain words, and says where you fit: what you make, for whom and where. Then get onto yelp.com, which AI read for this question.");
  });

  it("matches a competitor's site on any label but the ending and www, help or m", () => {
    const checks = [
      lost(["https://hillcrestbakery.square.site/"], [HILL]),
      lost(["https://www.order.honeycrumb.com/"], [HONEY]),
      lost(["https://m.yelp.com/a"], [HONEY]),
    ];
    expect(items(buildActionPlan(input(checks)), "sources").map(i => i.key)).toEqual(["source:m.yelp.com"]);
  });

  it("shows each page AI read once, not again under an image path or tracking tag", () => {
    const checks = [
      lost(["https://t.example/donut-shops/", "https://t.example/donut-shops/c_fill/"]),
      lost(["https://t.example/donut-shops/?utm_source=openai", "https://t.example/vegan/"]),
    ];
    const [t] = items(buildActionPlan(input(checks)), "sources");
    expect(t.evidence.slice(0, 2)).toEqual(["https://t.example/donut-shops/", "https://t.example/vegan/"]);
    // The homepage doesn't hide the pages under it.
    const home = items(buildActionPlan(input([lost(["https://h.example/"]), lost(["https://h.example/"]), lost(["https://h.example/menu"])])), "sources");
    expect(home[0].evidence.slice(0, 2)).toEqual(["https://h.example/", "https://h.example/menu"]);
  });

  it("counts Dunkin' and Dunkin as one business", () => {
    const checks = [lost(["https://yelp.com/a"], ["Dunkin'"]), lost(["https://yelp.com/b"], ["Dunkin"]), lost(["https://yelp.com/c"], ["Dunkin’", "Dunkin"])];
    const [yelp] = items(buildActionPlan(input(checks)), "sources");
    expect(yelp.why).toBe("In 3 answers that left you out, AI read yelp.com and named Dunkin' (3).");
  });

  it("only adds pages for words with a known page, never cakes, bakeries, oregon or shops", () => {
    const searches = ["donut shops portland oregon cakes bakeries 2026", "portland oregon bakeries cakes shops 2026"];
    const checks = [0, 1].map(i => check({ promptId: `s${i}`, promptText: "Donuts", searchQueries: searches }));
    const pages = items(buildActionPlan(input(checks, { today: new Date("2026-10-20T00:00:00Z") })), "pages");
    expect(pages.map(p => p.key)).toEqual(["page:pages-with-this-year-s-details"]);
    expect(pages[0].how).toBe("Put the date on your menu, prices and hours (\"Updated October 2026\") and refresh it when they change.");
    expect(pages.map(p => `${p.title} ${p.how}`).join(" ")).not.toMatch(/cakes|bakeries|oregon|shops/i);
  });
});
