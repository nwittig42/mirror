import { describe, it, expect } from "vitest";
import { KNOWN_PLATFORMS, parseCompetitorOutput, reconcileCompetitors } from "@/core/competitors";

describe("parseCompetitorOutput", () => {
  it("parses a bare JSON array of names", () => {
    expect(parseCompetitorOutput(`["Skin Bar LA", "Nuvo Aesthetics"]`)).toEqual(["Skin Bar LA", "Nuvo Aesthetics"]);
  });

  it("parses an array inside a fenced block with surrounding prose", () => {
    const raw = "Here you go:\n```json\n[\"Skin Bar LA\"]\n```\nLet me know.";
    expect(parseCompetitorOutput(raw)).toEqual(["Skin Bar LA"]);
  });

  it("drops blank entries and trims whitespace", () => {
    expect(parseCompetitorOutput(`["  Skin Bar LA ", "", "   "]`)).toEqual(["Skin Bar LA"]);
  });

  it("throws when no array is present", () => {
    expect(() => parseCompetitorOutput("No businesses mentioned.")).toThrow(/No JSON array/);
  });
});

describe("reconcileCompetitors", () => {
  const practiceNames = ["Glow MedSpa", "Glow Med Spa"];

  it("keeps known names and appends newly discovered ones", () => {
    const result = reconcileCompetitors({
      known: ["Skin Bar LA"], ignored: [], discovered: ["Nuvo Aesthetics"], practiceNames,
    });
    expect(result.all).toEqual(["Skin Bar LA", "Nuvo Aesthetics"]);
    expect(result.newlyDiscovered).toEqual(["Nuvo Aesthetics"]);
  });

  it("does not re-add a known name under different casing or spacing", () => {
    const result = reconcileCompetitors({
      known: ["Skin Bar LA"], ignored: [], discovered: ["skin bar  la"], practiceNames,
    });
    expect(result.all).toEqual(["Skin Bar LA"]);
    expect(result.newlyDiscovered).toEqual([]);
  });

  it("never treats the practice itself as a competitor", () => {
    const result = reconcileCompetitors({
      known: [], ignored: [], discovered: ["Glow Med Spa", "Glow MedSpa Santa Monica"], practiceNames,
    });
    expect(result.all).toEqual([]);
    expect(result.newlyDiscovered).toEqual([]);
  });

  it("skips names the operator has hidden", () => {
    // The hidden name used to be "Yelp"; spec section 3 now drops Yelp as a
    // platform regardless, so a business name is hidden here to keep the
    // operator rule under test.
    const result = reconcileCompetitors({
      known: [], ignored: ["Skin Bar LA"], discovered: ["Skin Bar LA", "Nuvo Aesthetics"], practiceNames,
    });
    expect(result.all).toEqual(["Nuvo Aesthetics"]);
    expect(result.newlyDiscovered).toEqual(["Nuvo Aesthetics"]);
  });

  it("dedupes within the discovered list itself", () => {
    const result = reconcileCompetitors({
      known: [], ignored: [], discovered: ["Nuvo Aesthetics", "NUVO AESTHETICS"], practiceNames,
    });
    expect(result.newlyDiscovered).toEqual(["Nuvo Aesthetics"]);
  });
});

describe("reconcileCompetitors name canonicalisation", () => {
  const practiceNames = ["Glow MedSpa"];

  it("strips a trailing location after a dash or in parentheses", () => {
    const result = reconcileCompetitors({
      known: [], ignored: [], practiceNames,
      discovered: ["Cienega Medical Spa – Santa Monica", "NAKEDMD (Santa Monica)", "Ava MD - Santa Monica"],
    });
    expect(result.newlyDiscovered).toEqual(["Cienega Medical Spa", "NAKEDMD", "Ava MD"]);
  });

  it("treats a longer name that starts with a known name as the same business", () => {
    const result = reconcileCompetitors({
      known: ["SkinLab", "Kare Plastic Surgery"], ignored: [], practiceNames,
      discovered: ["SkinLab Santa Monica", "Kare Plastic Surgery & Skin Health Center"],
    });
    expect(result.newlyDiscovered).toEqual([]);
  });

  it("does not merge on a short generic prefix", () => {
    const result = reconcileCompetitors({
      known: ["Skin"], ignored: [], practiceNames, discovered: ["Skin by Lovely"],
    });
    expect(result.newlyDiscovered).toEqual(["Skin by Lovely"]);
  });

  it("merges two discovered variants within the same answer", () => {
    const result = reconcileCompetitors({
      known: [], ignored: [], practiceNames,
      discovered: ["Self Care LA", "Self Care LA MedSpa", "Self Care LA – Med Spa Santa Monica"],
    });
    expect(result.newlyDiscovered).toEqual(["Self Care LA"]);
  });
});

describe("reconcileCompetitors practice names", () => {
  const practiceNames = ["Harbor Plumbing", "Harbor Plumbing LLC"];

  it("keeps a longer name that continues the practice's with a conjunction", () => {
    const result = reconcileCompetitors({
      known: [], ignored: [], practiceNames,
      discovered: ["Harbor Plumbing & Heating", "Harbor Plumbing and Drain", "Harbor Plumbing + Heating"],
    });
    expect(result.newlyDiscovered).toEqual(["Harbor Plumbing & Heating", "Harbor Plumbing and Drain", "Harbor Plumbing + Heating"]);
  });

  it("drops the practice with a location or descriptor tail", () => {
    const result = reconcileCompetitors({
      known: [], ignored: [], practiceNames,
      discovered: ["Harbor Plumbing Portland", "Harbor Plumbing Co", "Harbor Plumbing Andover", "Harbor Plumbing LLC of Portland"],
    });
    expect(result.newlyDiscovered).toEqual([]);
  });

  it("drops a name equal to a practice key, after canonicalisation", () => {
    const result = reconcileCompetitors({
      known: [], ignored: [], practiceNames,
      discovered: ["harbor plumbing", "Harbor Plumbing - Portland", "Harbor Plumbing (Portland, OR)", "HARBOR  PLUMBING LLC"],
    });
    expect(result.newlyDiscovered).toEqual([]);
  });

  it("drops a name that a practice key contains", () => {
    const result = reconcileCompetitors({
      known: [], ignored: [], practiceNames: ["Glow MedSpa"], discovered: ["Glow", "MedSpa", "glow medspa"],
    });
    expect(result.newlyDiscovered).toEqual([]);
  });

  it("keeps an unrelated name that merely shares a word", () => {
    const result = reconcileCompetitors({
      known: [], ignored: [], practiceNames, discovered: ["Portland Plumbing", "Harbor Freight"],
    });
    expect(result.newlyDiscovered).toEqual(["Portland Plumbing", "Harbor Freight"]);
  });

  it("drops the practice with a comma, possessive or hyphen tail, as the matcher reads it", () => {
    const result = reconcileCompetitors({
      known: [], ignored: [], practiceNames: ["Harbor Plumbing"],
      discovered: [
        "Harbor Plumbing, Inc.", "Harbor Plumbing, LLC", "Harbor Plumbing's", "Harbor Plumbing’s",
        "Harbor Plumbing, Portland", "Harbor Plumbing-Portland", "The Harbor Plumbing", "Harbor Plumbing & Heating",
      ],
    });
    expect(result.newlyDiscovered).toEqual(["Harbor Plumbing & Heating"]);
  });

  it("compares through the matcher's tokens, so spelling differences do not matter", () => {
    const result = reconcileCompetitors({
      known: [], ignored: [], practiceNames: ["Joe's Pizza", "The Rusty Anchor", "Crumb & Crust"],
      discovered: ["Joes Pizza", "Rusty Anchor", "Crumb and Crust", "Crumb and Crust Bakery", "Crumb & Crust & Sons", "Joe's Pizza and Pasta"],
    });
    expect(result.newlyDiscovered).toEqual(["Crumb & Crust & Sons", "Joe's Pizza and Pasta"]);
  });

  it("never drops everything for a practice name with nothing distinctive", () => {
    const result = reconcileCompetitors({
      known: [], ignored: [], practiceNames: ["LLC"], discovered: ["Rose City Plumbing"],
    });
    expect(result.newlyDiscovered).toEqual(["Rose City Plumbing"]);
  });
});

describe("reconcileCompetitors known platforms", () => {
  const practiceNames = ["Harbor Plumbing"];

  it("exports the platform list from spec section 3", () => {
    expect(KNOWN_PLATFORMS).toEqual([
      "yelp", "google", "google maps", "google business profile", "bing", "bing places", "apple maps",
      "yellow pages", "yp", "angi", "angie's list", "homeadvisor", "thumbtack", "houzz", "nextdoor",
      "facebook", "instagram", "tiktok", "youtube", "linkedin", "reddit", "tripadvisor",
      "bbb", "better business bureau", "groupon", "doordash", "uber eats", "grubhub", "opentable", "resy",
      "zillow", "realtor.com", "amazon", "realself", "healthgrades", "zocdoc", "vitals", "webmd",
      "avvo", "findlaw", "justia", "expertise.com", "three best rated",
    ]);
  });

  it("drops every platform by exact key, whatever the casing, spacing or apostrophe", () => {
    const result = reconcileCompetitors({
      known: [], ignored: [], practiceNames,
      discovered: [...KNOWN_PLATFORMS, "Yelp", "GOOGLE  MAPS", "Angie’s List", "Angie's List (Portland)", "Better Business Bureau - Oregon"],
    });
    expect(result.newlyDiscovered).toEqual([]);
  });

  it("keeps a business whose name only contains a platform word", () => {
    const result = reconcileCompetitors({
      known: [], ignored: [], practiceNames,
      discovered: ["Amazon Cleaning Co", "Yelp Plumbing", "Google Street Dental"],
    });
    expect(result.newlyDiscovered).toEqual(["Amazon Cleaning Co", "Yelp Plumbing", "Google Street Dental"]);
  });
});
