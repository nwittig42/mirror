import { describe, it, expect } from "vitest";
import { composePulse } from "@/services/pulse-email";

const base = { practiceName: "Glow MedSpa", score: 42, prevScore: 38, cited: 6, total: 40,
  bestQuote: { engine: "perplexity", snippet: "Glow MedSpa is known for natural results" },
  openFindings: 0, appUrl: "https://app.example", slug: "glow" };

describe("composePulse", () => {
  it("subject follows the locked format", () =>
    expect(composePulse(base).subject).toBe("What AI told patients about Glow MedSpa this week"));
  it("shows delta and check count", () => {
    const { html } = composePulse(base);
    expect(html).toContain("42");
    expect(html).toContain("+4");
    expect(html).toContain("6 of 40 checks");
  });
  it("renders the verbatim quote when present", () =>
    expect(composePulse(base).html).toContain("natural results"));
  it("first scan (no prev) omits delta", () =>
    expect(composePulse({ ...base, prevScore: null }).html).not.toContain("+"));
});
