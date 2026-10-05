import { describe, it, expect } from "vitest";
import { factPageLinks, htmlTitle, htmlToText } from "@/core/site-text";

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

  it("respects the limit", () => {
    expect(factPageLinks(html, "https://glow.example/", 1)).toEqual(["https://glow.example/about-us"]);
  });
});
