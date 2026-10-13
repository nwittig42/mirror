import { describe, it, expect } from "vitest";
import { factPageLinks, htmlTitle, htmlToText, sitePageLinks, telLinks } from "@/core/site-text";

describe("htmlToText", () => {
  it("drops scripts, styles and tags, decodes entities, keeps line breaks", () => {
    const html = `<html><head><style>p{}</style><script>var x = "<b>no</b>";</script></head>
      <body><h1>Glow&nbsp;MedSpa</h1><p>Botox &amp; fillers</p><!-- hidden --><div>$13/unit</div></body></html>`;
    expect(htmlToText(html)).toBe("Glow MedSpa\nBotox & fillers\n$13/unit");
  });
});

describe("htmlTitle", () => {
  it("reads the title", () => {
    expect(htmlTitle("<title> Glow &amp; Co </title>")).toBe("Glow & Co");
    expect(htmlTitle("<p>none</p>")).toBeNull();
  });
});

describe("factPageLinks", () => {
  const html = `
    <a href="/about-us">About</a>
    <a href="/pricing/#plans">Pricing</a>
    <a href="https://www.glow.example/services/botox?ref=nav">Botox</a>
    <a href="/blog/post-1">Blog</a>
    <a href="https://instagram.com/glow/about">IG</a>
    <a href="/menu.pdf">Menu PDF</a>
    <a href="mailto:hi@glow.example">Email</a>
    <a href="/about-us/">About again</a>
    <a href="#top">Top</a>`;

  it("keeps same-site fact pages, normalized and de-duplicated", () => {
    expect(factPageLinks(html, "https://glow.example/", 10)).toEqual([
      "https://glow.example/about-us",
      "https://glow.example/pricing",
      "https://www.glow.example/services/botox",
    ]);
  });

  it("keeps fee, estimate, quote, story and what-we-do pages, but not feedback", () => {
    const links = ["/fees", "/free-estimate", "/get-a-quote", "/fee-schedule", "/our-story", "/who-we-are", "/what-we-do", "/feedback", "/newsfeed", "/coffee"]
      .map(l => `<a href="${l}">x</a>`).join("");
    expect(factPageLinks(links, "https://glow.example/", 20)).toEqual([
      "https://glow.example/fees", "https://glow.example/free-estimate", "https://glow.example/get-a-quote", "https://glow.example/fee-schedule",
      "https://glow.example/our-story", "https://glow.example/who-we-are", "https://glow.example/what-we-do",
    ]);
  });

  it("respects the limit", () => {
    expect(factPageLinks(html, "https://glow.example/", 1)).toEqual(["https://glow.example/about-us"]);
  });
});

describe("telLinks", () => {
  it("returns tel: hrefs as written, decoded, and nothing else", () => {
    const html = `<a href="tel:+15035550100">Call</a> <a class="x" href='tel:(503)%20555-0100'>Call</a>
      <a href="mailto:hi@glow.example">Email</a> <a href="/contact">Contact</a> <a href="TEL:5035550100">Call</a>`;
    expect(telLinks(html)).toEqual(["tel:+15035550100", "tel:(503) 555-0100", "TEL:5035550100"]);
    expect(telLinks("<p>no links</p>")).toEqual([]);
  });
});

describe("sitePageLinks", () => {
  const html = `
    <a href="/the-bakery">The bakery</a>
    <a href="/blog/why-sourdough">Blog</a>
    <a href="/custom-cakes">Custom cakes</a>
    <a href="/pricing">Pricing</a>
    <a href="/privacy-policy">Privacy</a>
    <a href="/account/login">Log in</a>
    <a href="https://other.example/areas">Elsewhere</a>
    <a href="/areas-we-serve">Areas we serve</a>
    <a href="/menu.pdf">Menu PDF</a>`;

  it("reads fact-looking pages first, then the rest of the site, skipping posts, legal and account pages", () => {
    expect(sitePageLinks(html, "https://crumb.example/", 10)).toEqual([
      "https://crumb.example/pricing",
      "https://crumb.example/the-bakery",
      "https://crumb.example/custom-cakes",
      "https://crumb.example/areas-we-serve",
    ]);
  });

  it("stops at the limit, keeping the fact-looking pages", () => {
    expect(sitePageLinks(html, "https://crumb.example/", 2)).toEqual([
      "https://crumb.example/pricing",
      "https://crumb.example/the-bakery",
    ]);
  });
});
