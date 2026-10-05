import { describe, it, expect } from "vitest";
import { parseToneOutput, summarizeTone } from "@/core/tone";

describe("parseToneOutput", () => {
  it("reads a fenced array", () => {
    expect(parseToneOutput('```json\n[{"tone":"mixed","reason":"Good, but long waits."}]\n```'))
      .toEqual({ tone: "mixed", reason: "Good, but long waits." });
  });
  it("rejects an unknown tone", () => {
    expect(() => parseToneOutput('[{"tone":"great","reason":"x"}]')).toThrow();
  });
});

describe("summarizeTone", () => {
  it("counts rated mentions only and lists concerns worst first", () => {
    const s = summarizeTone([
      { mentioned: true, tone: "positive", toneReason: "Top pick" },
      { mentioned: true, tone: "mixed", toneReason: "Pricey" },
      { mentioned: true, tone: "negative", toneReason: "Bad reviews" },
      { mentioned: true, tone: null, toneReason: null },
      { mentioned: false, tone: "positive", toneReason: "ignored" },
    ]);
    expect(s.rated).toBe(3);
    expect(s.counts).toEqual({ positive: 1, neutral: 0, mixed: 1, negative: 1 });
    expect(s.concerns.map(c => c.reason)).toEqual(["Bad reviews", "Pricey"]);
  });
});
