import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AtAGlance, howOften, scoreBand } from "@/app/dashboard/[slug]/at-a-glance";

/**
 * The top of the Overview says, in words a business owner reads in seconds,
 * how often AI recommends them, what their score means, who AI picks
 * instead and what to do first.
 */
describe("howOften", () => {
  it("says the share the way a person would", () => {
    expect(howOften(21, 96)).toBe("about 1 in 5");
    expect(howOften(48, 96)).toBe("about half");
    expect(howOften(72, 96)).toBe("about 3 in 4");
    expect(howOften(0, 96)).toBe("none");
    expect(howOften(96, 96)).toBe("every one");
    expect(howOften(0, 0)).toBe("none");
  });
});

describe("scoreBand", () => {
  it("puts a score in the audit's three bands", () => {
    expect(scoreBand(35).label).toBe("Needs work");
    expect(scoreBand(56).label).toBe("Fair");
    expect(scoreBand(70).label).toBe("Strong");
  });
});

describe("AtAGlance", () => {
  const base = {
    slug: "harbor", practiceName: "Harbor Plumbing", named: 21, total: 96,
    tools: ["ChatGPT", "Claude", "Grok", "Google AI Mode"], score: 56,
    competitor: { name: "Rose City Plumbing", mentions: 25 },
    firstStep: { title: "Stand out on yelp.com" }, steps: 22,
  };

  it("leads with how often AI recommends the business, then the score, the rival and the first step", () => {
    const html = renderToStaticMarkup(<AtAGlance {...base} />);
    expect(html).toContain("AI recommends Harbor Plumbing in about 1 in 5 answers.");
    expect(html).toContain("We asked ChatGPT, Claude, Grok and Google AI Mode 96 questions your customers ask. You came up in 21.");
    expect(html).toContain("Fair");
    expect(html).toContain("Who AI picks instead");
    expect(html).toContain("Rose City Plumbing");
    expect(html).toContain("Stand out on yelp.com");
    expect(html).toContain('href="/dashboard/harbor/fixes"');
  });

  it("reads as a sentence when it is about half", () => {
    expect(renderToStaticMarkup(<AtAGlance {...base} named={48} />)).toContain("in about half the answers.");
  });

  it("says plainly when AI named the business nowhere", () => {
    const html = renderToStaticMarkup(<AtAGlance {...base} named={0} />);
    expect(html).toContain("AI didn&#x27;t recommend Harbor Plumbing in any of the answers we checked.");
  });
});
