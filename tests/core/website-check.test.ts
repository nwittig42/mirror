import { describe, it, expect } from "vitest";
import {
  blocksWholeSite, checkAiAllowed, checkFactsPage, checkMachineLabels, checkReadableText, checkSitemap, jsonLdTypes, parseRobots,
} from "@/core/website-check";
import { runWebsiteCheck } from "@/services/website-check";

describe("robots.txt", () => {
  it("applies an agent's own group over the * group", () => {
    const robots = parseRobots("User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /\n");
    expect(blocksWholeSite(robots, "GPTBot")).toBe(false);
    expect(blocksWholeSite(robots, "ClaudeBot")).toBe(true);
  });
  it("handles grouped agents and comments", () => {
    const robots = parseRobots("# hi\nUser-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: / # no AI\nSitemap: https://x.example/s.xml");
    expect(blocksWholeSite(robots, "claudebot")).toBe(true);
    expect(robots.sitemaps).toEqual(["https://x.example/s.xml"]);
  });
  it("passes with no robots file, warns on a few blocks, fails when most are blocked", () => {
    expect(checkAiAllowed(null).status).toBe("pass");
    expect(checkAiAllowed("User-agent: GPTBot\nDisallow: /").status).toBe("warn");
    const all = checkAiAllowed("User-agent: *\nDisallow: /");
    expect(all.status).toBe("fail");
    expect(all.fix).toMatch(/robots.txt/);
  });
  it("does not treat a partial disallow as a block", () => {
    expect(checkAiAllowed("User-agent: *\nDisallow: /admin").status).toBe("pass");
  });
});

describe("other checks", () => {
  it("grades readable text by length", () => {
    expect(checkReadableText(800).status).toBe("pass");
    expect(checkReadableText(200).status).toBe("warn");
    expect(checkReadableText(20).status).toBe("fail");
  });
  it("wants an about page and a pricing page", () => {
    const p = (path: string, title: string | null = null) => ({ url: `https://x.example${path}`, title });
    expect(checkFactsPage([p("/"), p("/about"), p("/pricing")]).status).toBe("pass");
    expect(checkFactsPage([p("/"), p("/services/botox")]).status).toBe("warn");
    expect(checkFactsPage([p("/", "Home")]).status).toBe("fail");
    expect(checkFactsPage([p("/", "Home"), p("/our-prices", "Price list")]).fix).toMatch(/about page/);
  });
  it("reads schema types, nested and in arrays", () => {
    const html = `<script type="application/ld+json">{"@type":["LocalBusiness"],"makesOffer":{"@type":"Offer"}}</script>
      <script type="application/ld+json">not json</script>`;
    expect(jsonLdTypes(html)).toEqual(["LocalBusiness", "Offer"]);
    expect(checkMachineLabels(["LocalBusiness", "Offer"]).status).toBe("pass");
    expect(checkMachineLabels(["LocalBusiness"]).status).toBe("warn");
    expect(checkMachineLabels([]).status).toBe("fail");
  });
  it("grades the sitemap", () => {
    expect(checkSitemap(true, false).status).toBe("pass");
    expect(checkSitemap(false, true).status).toBe("warn");
    expect(checkSitemap(false, false).status).toBe("fail");
  });
});

describe("runWebsiteCheck", () => {
  const long = "Glow MedSpa offers Botox and filler in Santa Monica. ".repeat(20);
  const site: Record<string, { body: string; type?: string; status?: number }> = {
    "https://glow.example": { body: `<title>Glow</title><a href="/about">About</a><a href="/pricing">Prices</a><p>${long}</p>` },
    "https://glow.example/about": { body: "<title>About us</title><p>Founded 2019</p>" },
    "https://glow.example/pricing": { body: `<title>Prices</title><script type="application/ld+json">{"@type":"Offer"}</script>` },
    "https://glow.example/robots.txt": { body: "User-agent: *\nAllow: /\nSitemap: https://glow.example/sitemap.xml", type: "text/plain" },
    "https://glow.example/sitemap.xml": { body: "<urlset></urlset>", type: "application/xml" },
  };
  const fakeFetch = (async (input: string | URL | Request) => {
    const hit = site[String(input)];
    return hit
      ? new Response(hit.body, { status: hit.status ?? 200, headers: { "content-type": hit.type ?? "text/html" } })
      : new Response("not found", { status: 404, headers: { "content-type": "text/html" } });
  }) as typeof fetch;

  it("passes a well-built site on every check", async () => {
    const result = await runWebsiteCheck("glow.example", fakeFetch);
    expect(result.error).toBeUndefined();
    expect(result.checks.map(c => [c.id, c.status])).toEqual([
      ["ai_allowed", "pass"], ["readable_text", "pass"], ["facts_page", "pass"], ["machine_labels", "pass"], ["sitemap", "pass"],
    ]);
    expect(result.pages.map(p => p.url)).toEqual(["https://glow.example", "https://glow.example/about", "https://glow.example/pricing"]);
    expect(result.homepageText).toContain("botox");
  });

  it("reports an unreachable site instead of throwing", async () => {
    const result = await runWebsiteCheck("https://down.example", fakeFetch);
    expect(result.error).toMatch(/Could not load/);
    expect(result.checks).toEqual([]);
  });

  it("refuses internal addresses", async () => {
    expect((await runWebsiteCheck("http://localhost:3000", fakeFetch)).error).toMatch(/public/);
  });
});
