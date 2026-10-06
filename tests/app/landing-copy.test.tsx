import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import LandingPage from "@/app/page";

/**
 * The public copy, the README's ship checklist and the demo seed all describe
 * the same product and the same fictional business. These pin the places a
 * review found them disagreeing.
 */
const root = path.resolve(__dirname, "../..");
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const html = renderToStaticMarkup(<LandingPage />);
const seed = readFileSync(path.join(root, "scripts/seed.ts"), "utf8");
const readme = readFileSync(path.join(root, "README.md"), "utf8");

describe("landing page engines", () => {
  // Review finding: the page counted five engines and listed five in the
  // strip, but the "Citation rate by engine" panel showed four rows (no Grok)
  // and the footer disclaimer named four vendors (no xAI), unlike /book.
  it("shows one citation-rate row per engine in the strip, Grok included", () => {
    const strip = [...html.matchAll(/<span class="eng">([^<]+)<\/span>/g)].map(m => m[1]);
    expect(strip).toEqual(["ChatGPT", "Claude", "Gemini", "Grok", "Perplexity"]);
    const panel = html.slice(html.indexOf("Citation rate by engine"), html.indexOf("AI Visibility Score"));
    const rows = [...panel.matchAll(/<span style="width:84px">([^<]+)<\/span>/g)].map(m => m[1]);
    expect(rows).toHaveLength(5);
    expect([...rows].sort()).toEqual([...strip].sort());
    expect(rows).toContain("Grok");
  });

  it("names xAI in the footer disclaimer, the same as /book", () => {
    expect(text(html)).toContain("Not affiliated with OpenAI, Anthropic, Google, xAI, or Perplexity.");
  });

  it("promises five engines everywhere it counts them", () => {
    const words = text(html);
    expect(words).toContain("5 answer engines scanned every week");
    expect(words).not.toMatch(/up to five/i);
  });
});

describe("the five-engine promise and XAI_API_KEY", () => {
  // Review finding: Grok only runs when XAI_API_KEY is set, yet the public
  // copy promises five engines unconditionally. The ship checklist is where
  // the operator learns the key is not optional in production.
  it("is on the README's ship checklist as a key that must be set", () => {
    const checklist = readme.slice(readme.indexOf("## Ship checklist"), readme.indexOf("## The weekly cycle"));
    const line = checklist.split("\n").find(l => l.includes("`XAI_API_KEY`"))!;
    expect(line).toBeDefined();
    expect(line).toMatch(/must be set/i);
    expect(line).toMatch(/five engines/i);
    expect(line).not.toMatch(/^\s*-\s*`XAI_API_KEY` \(optional/);
  });
});

describe("the seeded demo business", () => {
  const prompts = [...seed.matchAll(/kind: "(category|branded|informational)", text: "([^"]+)"/g)].map(m => ({ kind: m[1], text: m[2] }));

  // Review finding: the two informational prompts asked about "Oregon" only.
  // Informational prompts count as earned, and the engines are sent no user
  // location, so a prompt without the city could never name a local business.
  it("names Portland in every prompt, the informational ones included", () => {
    expect(prompts).toHaveLength(10);
    expect(prompts.filter(p => p.kind === "informational")).toHaveLength(2);
    for (const p of prompts) expect(p.text).toMatch(/Portland/);
    expect(prompts.map(p => p.text)).toContain("How much does it cost to replace a water heater in Portland, OR in 2026?");
  });

  it("is the business on the landing page's Fact Sheet panel and in the report preview", () => {
    const count = (category: string) => (seed.match(new RegExp(`category: "${category}"`, "g")) ?? []).length;
    const variations = (seed.slice(seed.indexOf("insert(nameVariations)")).match(/text: "/g) ?? []).length;
    const panel = text(html.slice(html.indexOf("Fact Sheet · Harbor Plumbing and Drain"), html.indexOf("Citation rate by engine")));
    expect(panel).toContain(`People ${count("providers")} verified`);
    expect(panel).toContain(`Services ${count("services")} listed`);
    expect(panel).toContain(`Not offered ${count("not_offered")} listed`);
    expect(panel).toContain(`Name variations ${variations} tracked`);
    // 24/7 emergency service is on the not-offered list; the card marks it false.
    expect(seed).toMatch(/not_offered", label: "24\/7 emergency service"/);
    expect(html).toContain('<span class="mk-false">24/7 emergency service</span>');
    for (const name of ["Rose City Rooter", "Bridgetown Drain Pros", "Willamette Pipeworks"]) expect(seed).toContain(`name: "${name}"`);
  });
});
