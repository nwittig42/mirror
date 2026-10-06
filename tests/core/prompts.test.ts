import { describe, it, expect } from "vitest";
import { generateFallbackPrompts, pluralize, type FallbackPromptInput } from "@/core/prompts";

const harbor: FallbackPromptInput = { name: "Harbor Plumbing", category: "Plumber", location: "Portland, OR" };
const texts = (input: FallbackPromptInput) => generateFallbackPrompts(input).map(q => q.text);

describe("generateFallbackPrompts", () => {
  it("returns the six standard questions in order: four category, then two branded", () => {
    expect(generateFallbackPrompts(harbor)).toEqual([
      { text: "What are the best plumbers in Portland, OR? Name specific businesses.", kind: "category" },
      { text: "Can you recommend a good plumber in Portland, OR?", kind: "category" },
      { text: "I'm looking for a plumber in Portland, OR. Which ones should I consider?", kind: "category" },
      { text: "Compare the top plumbers in Portland, OR. Which would you choose?", kind: "category" },
      { text: "What do you know about Harbor Plumbing in Portland, OR?", kind: "branded" },
      { text: "What are people saying about Harbor Plumbing in Portland, OR?", kind: "branded" },
    ]);
  });

  it("names the location in every question and never leans on where the reader is", () => {
    for (const trade of [
      { name: "Rose City Bakery", category: "Bakery", location: "Portland, OR" },
      { name: "Glow MedSpa", category: "Med spa", location: "Austin, TX" },
      { name: "Lee & Park Law", category: "Law firm", location: "the East Bay" },
    ]) {
      const out = generateFallbackPrompts(trade);
      expect(out).toHaveLength(6);
      for (const q of out) {
        expect(q.text).toContain(trade.location);
        expect(q.text.toLowerCase()).not.toContain("near me");
      }
    }
  });

  it("is deterministic for the same input", () => {
    expect(generateFallbackPrompts(harbor)).toEqual(generateFallbackPrompts({ ...harbor }));
    expect(generateFallbackPrompts({ name: " Harbor  Plumbing ", category: " Plumber", location: "Portland,  OR " }))
      .toEqual(generateFallbackPrompts(harbor));
  });

  it("pluralises the last word of the category and lowers a typed capital, keeping acronyms", () => {
    expect(texts({ ...harbor, category: "Med Spa" })[0]).toBe("What are the best med spas in Portland, OR? Name specific businesses.");
    expect(texts({ ...harbor, category: "Bakery" })[3]).toBe("Compare the top bakeries in Portland, OR. Which would you choose?");
    expect(texts({ ...harbor, category: "HVAC contractor" })[1]).toBe("Can you recommend a good HVAC contractor in Portland, OR?");
    expect(texts({ ...harbor, category: "Attorney" })[2]).toBe("I'm looking for an attorney in Portland, OR. Which ones should I consider?");
  });

  it("refuses a blank category or location rather than asking about nowhere", () => {
    expect(() => generateFallbackPrompts({ ...harbor, location: " " })).toThrow(/location/);
    expect(() => generateFallbackPrompts({ ...harbor, category: "" })).toThrow(/category/);
  });
});

describe("pluralize", () => {
  it("adds es after s, x, z, ch and sh", () => {
    expect(pluralize("business")).toBe("businesses");
    expect(pluralize("tax")).toBe("taxes");
    expect(pluralize("blitz")).toBe("blitzes");
    expect(pluralize("church")).toBe("churches");
    expect(pluralize("wash")).toBe("washes");
  });
  it("turns a consonant plus y into ies and leaves a vowel plus y alone", () => {
    expect(pluralize("bakery")).toBe("bakeries");
    expect(pluralize("attorney")).toBe("attorneys");
  });
  it("adds s to everything else", () => {
    expect(pluralize("plumber")).toBe("plumbers");
    expect(pluralize("spa")).toBe("spas");
  });
});
