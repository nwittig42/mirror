import { describe, it, expect } from "vitest";
import { logoCandidates } from "@/core/logo";

const page = "https://www.example.com/home";

describe("logoCandidates", () => {
  it("puts the home-screen icon first, largest first, then tab icons", () => {
    const html = `
      <link rel="icon" href="/favicon-32.png" sizes="32x32">
      <link rel="apple-touch-icon" sizes="120x120" href="/touch-120.png">
      <link rel="apple-touch-icon" sizes="180x180" href="/touch-180.png">
      <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">`;
    expect(logoCandidates(html, page).slice(0, 4)).toEqual([
      "https://www.example.com/touch-180.png",
      "https://www.example.com/touch-120.png",
      "https://www.example.com/icon-192.png",
      "https://www.example.com/favicon-32.png",
    ]);
  });
  it("ranks a vector tab icon above bitmap ones", () => {
    const html = `<link rel="icon" sizes="512x512" href="/big.png"><link rel='shortcut icon' type='image/svg+xml' href='/mark.svg'>`;
    expect(logoCandidates(html, page).slice(0, 2)).toEqual([
      "https://www.example.com/mark.svg", "https://www.example.com/big.png",
    ]);
  });
  it("reads the logo named in business schema, in either shape", () => {
    expect(logoCandidates(`<script type="application/ld+json">{"@type":"Organization","logo":"https:\\/\\/cdn.example.com\\/logo.png"}</script>`, page))
      .toContain("https://cdn.example.com/logo.png");
    expect(logoCandidates(`{"logo":{"@type":"ImageObject","url":"/img/logo.png"}}`, page))
      .toContain("https://www.example.com/img/logo.png");
  });
  it("always ends with the two addresses browsers fall back to", () => {
    expect(logoCandidates("", page)).toEqual([
      "https://www.example.com/apple-touch-icon.png", "https://www.example.com/favicon.ico",
    ]);
  });
  it("skips inline and non-web addresses and other link tags", () => {
    const html = `<link rel="icon" href="data:image/png;base64,AAAA"><link rel="icon" href="javascript:alert(1)"><link rel="stylesheet" href="/icon.css">`;
    expect(logoCandidates(html, page)).toEqual([
      "https://www.example.com/apple-touch-icon.png", "https://www.example.com/favicon.ico",
    ]);
  });
});
