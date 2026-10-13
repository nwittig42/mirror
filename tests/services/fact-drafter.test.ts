import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import { draftFactsFromPages, fetchSitePages, saveDraftFacts } from "@/services/fact-drafter";

const site: Record<string, string> = {
  "https://glow.example": `<title>Glow</title><a href="/pricing">Prices</a><a href="/careers">Jobs</a><p>Glow MedSpa, Santa Monica</p>`,
  "https://glow.example/pricing": `<p>Botox $13/unit</p>`,
};

const fakeFetch = (async (input: string | URL | Request) => {
  const url = String(input);
  const html = site[url];
  return html === undefined
    ? new Response("nope", { status: 404 })
    : new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}) as typeof fetch;

describe("fetchSitePages", () => {
  it("reads the homepage and the fact pages it links to", async () => {
    const pages = await fetchSitePages("glow.example", fakeFetch);
    expect(pages.map(p => p.url)).toEqual(["https://glow.example", "https://glow.example/pricing"]);
    expect(pages[0]).toMatchObject({ title: "Glow" });
    expect(pages[1].text).toBe("Botox $13/unit");
  });

  it("refuses internal addresses", async () => {
    await expect(fetchSitePages("http://localhost:3000", fakeFetch)).rejects.toThrow(/public website/);
    await expect(fetchSitePages("http://192.168.1.1", fakeFetch)).rejects.toThrow(/public website/);
  });

  it("fails clearly when the homepage will not load", async () => {
    await expect(fetchSitePages("https://down.example", fakeFetch)).rejects.toThrow(/Could not load/);
  });
});

describe("draftFactsFromPages", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://x";
    process.env.OPENAI_API_KEY = "k";
    process.env.ANTHROPIC_API_KEY = "k";
    process.env.GEMINI_API_KEY = "k";
    process.env.PERPLEXITY_API_KEY = "k";
    process.env.RESEND_API_KEY = "k";
    process.env.CRON_SECRET = "s";
    process.env.AUTH_SECRET = "s";
    process.env.APP_URL = "http://localhost:3000";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("asks for headings chosen for this business, in any trade, and parses the old shape as before", async () => {
    const drafted = [
      { category: "providers", label: "Owner", value: "Sam Lee, licensed master plumber", sourceUrl: "https://harbor.example/about" },
      { category: "pricing", label: "Drain cleaning", value: "From $149", sourceUrl: "https://harbor.example/made-up" },
    ];
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: "text", text: JSON.stringify(drafted) }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await draftFactsFromPages({
      businessName: "Harbor Plumbing",
      pages: [{ url: "https://harbor.example/about", title: "About", text: "Owner Sam Lee, licensed master plumber" }],
    });
    expect(out).toEqual([
      { category: "providers", label: "Owner", value: "Sam Lee, licensed master plumber", sourceUrl: "https://harbor.example/about" },
      // A page we never fetched is not cited.
      { category: "pricing", label: "Drain cleaning", value: "From $149", sourceUrl: null },
    ]);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const system: string = body.system;
    // The drafter chooses the headings for this one business; no standard list.
    expect(system).toContain("Decide the sections THIS business's fact sheet needs");
    expect(system).toContain("do not use a standard list");
    // Examples span trades, so no single trade shapes the sheet.
    for (const example of ["bakery", "law firm", "plumber", "Water heater install price", "Head baker", "Contractor license"]) {
      expect(system).toContain(example);
    }
    expect(system).toContain("- providers: a named person who delivers the service or runs the business");
    // The internal types the parser accepts are unchanged, and the heading is asked for separately.
    for (const category of ["identity", "providers", "services", "not_offered", "pricing", "logistics", "compliance"]) {
      expect(system).toContain(`- ${category}:`);
    }
    expect(system).toContain('"section": "<the heading you chose>"');
    expect(body.messages[0].content).toContain("BUSINESS: Harbor Plumbing");
    expect(body.messages[0].content).toContain("PAGE: https://harbor.example/about");
  });
});

describe("saveDraftFacts", () => {
  it("saves drafts and skips labels already on the sheet", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, {
      name: "Glow MedSpa",
      facts: [{ category: "pricing", label: "Botox price", value: "$13/unit" }],
    });
    const added = await saveDraftFacts(db, practiceId, [
      { category: "pricing", label: "botox PRICE", value: "$12/unit", sourceUrl: null },
      { category: "logistics", label: "Address", value: "123 Main St", sourceUrl: "https://glow.example" },
    ]);
    expect(added).toBe(1);
    const rows = await db.query.facts.findMany();
    const draft = rows.find(r => r.label === "Address")!;
    expect(draft).toMatchObject({ status: "draft", source: "website", sourceUrl: "https://glow.example" });
  });

  it("saves each draft's heading and keeps the order the drafter wrote them in", async () => {
    const db = await makeTestDb();
    const { practiceId } = await seedPractice(db, { name: "Crumb Bakery" });
    await saveDraftFacts(db, practiceId, [
      { section: "Menu", category: "services", label: "Sourdough loaf", value: "Baked daily", sourceUrl: null },
      { section: "Menu", category: "pricing", label: "Loaf price", value: "$9", sourceUrl: null },
      { section: "Allergens", category: "services", label: "Nut-free kitchen", value: "No", sourceUrl: null },
      { category: "logistics", label: "Address", value: "5 Main St", sourceUrl: null },
    ]);
    const rows = await db.query.facts.findMany({ orderBy: (f, { asc }) => [asc(f.createdAt)] });
    expect(rows.map(r => [r.section, r.label])).toEqual([
      ["Menu", "Sourdough loaf"], ["Menu", "Loaf price"], ["Allergens", "Nut-free kitchen"], [null, "Address"],
    ]);
  });
});
