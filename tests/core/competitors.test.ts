import { describe, it, expect } from "vitest";
import { parseCompetitorOutput, reconcileCompetitors } from "@/core/competitors";

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
    const result = reconcileCompetitors({
      known: [], ignored: ["Yelp"], discovered: ["Yelp", "Nuvo Aesthetics"], practiceNames,
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
