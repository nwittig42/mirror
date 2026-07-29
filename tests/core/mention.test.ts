import { describe, it, expect } from "vitest";
import { detectMention, detectNames, findMatches, highlightRanges } from "@/core/mention";

describe("detectMention", () => {
  it("matches case-insensitively", () =>
    expect(detectMention("I recommend GLOW medspa.", ["Glow MedSpa"])).toBe(true));
  it("matches any variation", () =>
    expect(detectMention("Dr. Kim's clinic is popular", ["Glow MedSpa", "Dr. Kim"])).toBe(true));
  it("requires word boundaries (no substring false positives)", () =>
    expect(detectMention("The glowing reviews mention nothing", ["Glow"])).toBe(false));
  it("tolerates punctuation and possessives", () =>
    expect(detectMention("Try Glow MedSpa's injectors.", ["Glow MedSpa"])).toBe(true));
  it("handles markdown bold", () =>
    expect(detectMention("1. **Glow MedSpa** – Santa Monica", ["Glow MedSpa"])).toBe(true));
});

describe("detectNames", () => {
  it("returns names in order of first appearance", () =>
    expect(detectNames("B Clinic is great; A Spa is fine too", ["A Spa", "B Clinic", "C Derm"]))
      .toEqual(["B Clinic", "A Spa"]));
});

describe("findMatches", () => {
  it("returns match objects with name, start, and end positions", () => {
    const matches = findMatches("Glow MedSpa and Derm House", ["Glow MedSpa", "Derm House"]);
    expect(matches).toEqual([
      { name: "Glow MedSpa", start: 0, end: 11 },
      { name: "Derm House", start: 16, end: 26 }
    ]);
  });
});

describe("highlightRanges", () => {
  it("returns every occurrence of a variation, not just the first", () => {
    const ranges = highlightRanges(
      "Glow MedSpa is great. Visit Glow MedSpa today for Glow MedSpa specials.",
      ["Glow MedSpa"],
    );
    expect(ranges).toEqual([
      { start: 0, end: 11 },
      { start: 28, end: 39 },
      { start: 50, end: 61 },
    ]);
  });

  it("matches multiple variations across the answer", () => {
    const ranges = highlightRanges("Dr. Kim runs Glow MedSpa downtown.", ["Glow MedSpa", "Dr. Kim"]);
    expect(ranges).toEqual([
      { start: 0, end: 7 },
      { start: 13, end: 24 },
    ]);
  });

  it("merges overlapping ranges from different variations (name contained in another)", () => {
    const ranges = highlightRanges("Glow MedSpa is downtown.", ["Glow MedSpa", "Glow"]);
    expect(ranges).toEqual([{ start: 0, end: 11 }]);
  });

  it("requires word boundaries (no substring false positives)", () => {
    expect(highlightRanges("The glowing reviews mention nothing", ["Glow"])).toEqual([]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(highlightRanges("Nothing here.", ["Glow MedSpa"])).toEqual([]);
  });
});
