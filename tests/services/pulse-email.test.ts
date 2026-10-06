import { describe, it, expect } from "vitest";
import { composePulse } from "@/services/pulse-email";

const base = { practiceName: "Harbor Plumbing and Drain", score: 42, prevScore: 38, cited: 6, total: 40,
  bestQuote: { engine: "perplexity", snippet: "Harbor Plumbing and Drain is known for honest pricing" },
  openFindings: 0, appUrl: "https://app.example", slug: "harbor-plumbing", coverageNote: null };

describe("composePulse", () => {
  it("subject follows the locked format", () =>
    expect(composePulse(base).subject).toBe("What AI told customers about Harbor Plumbing and Drain this week"));
  it("shows delta and check count", () => {
    const { html } = composePulse(base);
    expect(html).toContain("42");
    expect(html).toContain("+4");
    expect(html).toContain("Named in 6 of 40 answers");
    // The denominator has to be explained, or the client reads it as every
    // check that ran rather than only the ones that didn't name them.
    expect(html).toContain("didn&apos;t mention you by name".replace("&apos;", "'"));
  });
  it("renders the verbatim quote when present", () =>
    expect(composePulse(base).html).toContain("honest pricing"));
  it("first scan (no prev) omits delta", () =>
    expect(composePulse({ ...base, prevScore: null }).html).not.toContain("+"));
  it("zero-delta week omits the parenthetical too", () => {
    const { html } = composePulse({ ...base, prevScore: base.score });
    expect(html).not.toContain("(+0)");
    expect(html).not.toContain("(0)");
  });
  it("escapes HTML in the quote snippet instead of interpolating it raw", () => {
    const { html } = composePulse({
      ...base,
      bestQuote: { engine: "perplexity", snippet: "<script>alert(1)</script>" },
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
  // Section 8 of the general-business spec: a reader is a customer of a
  // business, whatever the trade. The old words must not creep back in.
  it("speaks of customers and a business, never patients or a practice", () => {
    const { subject, html } = composePulse({ ...base, openFindings: 2 });
    expect(`${subject} ${html}`).not.toMatch(/patient|practice\b|provider|treatment/i);
    expect(`${subject} ${html}`).not.toContain("\u2014");
  });
});

describe("composePulse coverage note", () => {
  it("says when the scan was short", () => {
    const { html } = composePulse({ ...base, coverageNote: "Based on 4 of 5 AI tools. Gemini didn't respond." });
    expect(html).toContain("Based on 4 of 5 AI tools. Gemini didn&#39;t respond.");
  });
  it("says nothing when every tool answered", () => {
    expect(composePulse(base).html).not.toContain("Based on");
  });
});
