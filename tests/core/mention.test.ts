import { describe, it, expect } from "vitest";
import { detectMention, detectNames, findMatches } from "@/core/mention";

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
