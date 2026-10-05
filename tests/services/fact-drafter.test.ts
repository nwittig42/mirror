import { describe, it, expect } from "vitest";
import { makeTestDb, seedPractice } from "../helpers/db";
import { fetchSitePages, saveDraftFacts } from "@/services/fact-drafter";

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
});
