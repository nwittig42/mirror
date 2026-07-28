import { describe, it, expect } from "vitest";
import { classifyPosition } from "@/core/position";

const practiceNames = ["Glow MedSpa", "Glow"];
const comps = ["Lumière Aesthetics", "Skin Bar LA", "Derm House"];

describe("classifyPosition", () => {
  it("absent when practice missing", () => {
    const r = classifyPosition("Try Skin Bar LA or Derm House.", practiceNames, comps);
    expect(r.position).toBe("absent");
    expect(r.competitorsMentioned).toEqual(["Skin Bar LA", "Derm House"]);
  });
  it("first when practice appears before all competitors", () =>
    expect(classifyPosition("Glow MedSpa leads; Derm House follows.", practiceNames, comps).position).toBe("first"));
  it("top3 when practice is 2nd or 3rd entity", () =>
    expect(classifyPosition("Skin Bar LA, then Glow MedSpa, then Derm House.", practiceNames, comps).position).toBe("top3"));
  it("mentioned when practice is 4th+", () =>
    expect(classifyPosition("Skin Bar LA, Derm House, Lumière Aesthetics, and Glow MedSpa.", practiceNames, comps).position).toBe("mentioned"));

  // Prefix collision tests
  it("suppresses practice prefix match when competitor is longer", () => {
    const r = classifyPosition("Glow Aesthetics dominates the market.", ["Glow"], ["Glow Aesthetics"]);
    expect(r.position).toBe("absent");
    expect(r.competitorsMentioned).toEqual(["Glow Aesthetics"]);
  });

  it("suppresses competitor prefix match when practice is longer", () => {
    const r = classifyPosition("Glow MedSpa is excellent.", ["Glow MedSpa"], ["Glow"]);
    expect(r.position).toBe("first");
    expect(r.competitorsMentioned).toEqual([]);
  });

  it("deduplicates competitors in competitorsMentioned", () => {
    const r = classifyPosition("Skin Bar LA is fine", [], ["Skin Bar LA", "Skin Bar LA"]);
    expect(r.position).toBe("absent");
    expect(r.competitorsMentioned).toEqual(["Skin Bar LA"]);
  });
});
