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
  it("reads a conjunction between two known names as a list, not a longer name", () => {
    const r = classifyPosition("Skin Bar LA and Glow MedSpa are both good.", practiceNames, comps);
    expect(r.competitorsMentioned).toEqual(["Skin Bar LA"]);
    expect(r.namedOrder).toEqual(["Skin Bar LA", "Glow MedSpa"]);
    expect(r.position).toBe("top3");
  });
  it("still rejects a name the conjunction joins to a capitalised word nobody knows", () => {
    const r = classifyPosition("Skin Bar LA and Someplace Else is good; Glow MedSpa too.", practiceNames, comps);
    expect(r.competitorsMentioned).toEqual([]);
    expect(r.position).toBe("first");
  });

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

  it("counts a later occurrence when the first is swallowed by a longer competitor span", () => {
    const r = classifyPosition(
      "Rose City Plumbing Pros is a chain; Rose City Plumbing is the local one and cheaper.",
      ["Rose City Plumbing"], ["Rose City Plumbing Pros"],
    );
    expect(r.position).toBe("top3");
    expect(r.competitorsMentioned).toEqual(["Rose City Plumbing Pros"]);
    expect(r.namedOrder).toEqual(["Rose City Plumbing Pros", "Rose City Plumbing"]);
  });

  it("counts a later competitor occurrence when the first is swallowed by the practice's span", () => {
    const r = classifyPosition("Glow MedSpa is great. Glow (downtown) is a different shop.", ["Glow MedSpa"], ["Glow"]);
    expect(r.position).toBe("first");
    expect(r.competitorsMentioned).toEqual(["Glow"]);
    expect(r.namedOrder).toEqual(["Glow MedSpa", "Glow"]);
  });

  it("still suppresses a name that only ever appears inside a longer one", () => {
    const r = classifyPosition("Glow MedSpa is great. Glow MedSpa again.", ["Glow MedSpa"], ["Glow"]);
    expect(r.position).toBe("first");
    expect(r.competitorsMentioned).toEqual([]);
    const s = classifyPosition("Glow Aesthetics is great; Glow Aesthetics again.", ["Glow"], ["Glow Aesthetics"]);
    expect(s.position).toBe("absent");
    expect(s.namedOrder).toEqual(["Glow Aesthetics"]);
  });

  it("resolves containment between two competitors per occurrence", () => {
    const r = classifyPosition("Glow MedSpa is great. Glow is a different shop.", ["Harbor Plumbing"], ["Glow", "Glow MedSpa"]);
    expect(r.competitorsMentioned).toEqual(["Glow MedSpa", "Glow"]);
  });
});

describe("classifyPosition namedOrder", () => {
  it("returns every business named in order of first appearance, practice included", () => {
    const { namedOrder } = classifyPosition(
      "Skin Bar LA is great. Glow MedSpa is also solid, as is Nuvo Aesthetics. Skin Bar LA again.",
      ["Glow MedSpa"], ["Skin Bar LA", "Nuvo Aesthetics"],
    );
    expect(namedOrder).toEqual(["Skin Bar LA", "Glow MedSpa", "Nuvo Aesthetics"]);
  });

  it("uses the practice's canonical name even when a variation matched", () => {
    const { namedOrder } = classifyPosition("Try Glow Med Spa.", ["Glow MedSpa", "Glow Med Spa"], []);
    expect(namedOrder).toEqual(["Glow MedSpa"]);
  });
});

describe("classifyPosition with the tolerant matcher, the guard and echo detection", () => {
  it("absent when the practice name is only the start of a longer business name", () => {
    const answer = "Harbor Plumbing & Heating is top rated.";
    expect(classifyPosition(answer, ["Harbor Plumbing"], []))
      .toEqual({ position: "absent", competitorsMentioned: [], namedOrder: [] });
    expect(classifyPosition(answer, ["Harbor Plumbing"], ["Harbor Plumbing & Heating"])).toEqual({
      position: "absent",
      competitorsMentioned: ["Harbor Plumbing & Heating"],
      namedOrder: ["Harbor Plumbing & Heating"],
    });
  });

  it("absent on an echo, while competitors named in the same sentence still count", () => {
    const r = classifyPosition(
      "I couldn't find any information about Harbor Plumbing, so consider Roto-Rooter or Mr. Rooter instead.",
      ["Harbor Plumbing"], ["Roto-Rooter", "Mr. Rooter"],
    );
    expect(r.position).toBe("absent");
    expect(r.competitorsMentioned).toEqual(["Roto-Rooter", "Mr. Rooter"]);
    expect(r.namedOrder).toEqual(["Roto-Rooter", "Mr. Rooter"]);
  });

  it("counts a real mention that follows an echo", () => {
    const r = classifyPosition(
      "I couldn't find pricing for Harbor Plumbing. Harbor Plumbing is well reviewed; Roto-Rooter is pricier.",
      ["Harbor Plumbing"], ["Roto-Rooter"],
    );
    expect(r.position).toBe("first");
    expect(r.namedOrder).toEqual(["Harbor Plumbing", "Roto-Rooter"]);
  });

  it("keeps a but-clause mention", () => {
    const r = classifyPosition("Not much information on Harbor Plumbing, but they are well reviewed.", ["Harbor Plumbing"], []);
    expect(r.position).toBe("first");
    expect(r.namedOrder).toEqual(["Harbor Plumbing"]);
  });

  it("absent when the but-clause is about a competitor", () => {
    const r = classifyPosition(
      "I couldn't find any information about Harbor Plumbing, but Roto-Rooter and Mr. Rooter are solid options.",
      ["Harbor Plumbing"], ["Roto-Rooter", "Mr. Rooter"],
    );
    expect(r.position).toBe("absent");
    expect(r.namedOrder).toEqual(["Roto-Rooter", "Mr. Rooter"]);
    expect(classifyPosition("I don't have details on Harbor Plumbing; however, Mr. Rooter is well known.", ["Harbor Plumbing"], ["Mr. Rooter"]))
      .toEqual({ position: "absent", competitorsMentioned: ["Mr. Rooter"], namedOrder: ["Mr. Rooter"] });
    const kept = classifyPosition("I couldn't find much about Harbor Plumbing, but they are cheaper than Roto-Rooter.", ["Harbor Plumbing"], ["Roto-Rooter"]);
    expect(kept.position).toBe("first");
    expect(kept.namedOrder).toEqual(["Harbor Plumbing", "Roto-Rooter"]);
  });

  it("keeps a label line that describes the business before a caveat", () => {
    const r = classifyPosition(
      "- Roto-Rooter: 24/7 emergency.\n- Harbor Plumbing: well reviewed on Yelp; no details on pricing.",
      ["Harbor Plumbing"], ["Roto-Rooter"],
    );
    expect(r.position).toBe("top3");
    expect(r.namedOrder).toEqual(["Roto-Rooter", "Harbor Plumbing"]);
  });

  it("keeps a recommendation followed by a sentence that starts with And", () => {
    const r = classifyPosition("I'd go with Harbor Plumbing. And Portland has plenty of other options.", ["Harbor Plumbing"], []);
    expect(r.position).toBe("first");
  });

  it("does not match a city-plus-trade name across a sentence end", () => {
    const r = classifyPosition(
      "Several licensed companies serve Portland. Plumbing rates there run $120 to $200 per hour. Roto-Rooter is a safe bet.",
      ["Portland Plumbing"], ["Roto-Rooter"],
    );
    expect(r.position).toBe("absent");
    expect(r.namedOrder).toEqual(["Roto-Rooter"]);
  });

  it("matches the typed name through a legal suffix and an apostrophe difference", () => {
    const r = classifyPosition("Joes Pizza is great; Harbor Plumbing is a plumber.", ["Harbor Plumbing LLC"], ["Joe's Pizza"]);
    expect(r.position).toBe("top3");
    expect(r.competitorsMentioned).toEqual(["Joe's Pizza"]);
    expect(r.namedOrder).toEqual(["Joe's Pizza", "Harbor Plumbing LLC"]);
  });

  it("collapses variations that match the same span into one practice entity", () => {
    const r = classifyPosition("Skin Lab is great; SkinLab again.", ["SkinLab", "Skin Lab"], []);
    expect(r.position).toBe("first");
    expect(r.namedOrder).toEqual(["SkinLab"]);
  });

  it("does not let the practice match a different business that shares its first words", () => {
    const r = classifyPosition(
      "Main Street Dental Associates is the top choice.",
      ["Main Street Dental Group"], ["Main Street Dental Associates"],
    );
    expect(r.position).toBe("absent");
    expect(r.competitorsMentioned).toEqual(["Main Street Dental Associates"]);
  });

  it("never matches a generic word from a one-token name", () => {
    const r = classifyPosition("The best place for pasta is Rossi's.", ["The Pasta Co"], ["Rossi's"]);
    expect(r.position).toBe("absent");
    expect(r.namedOrder).toEqual(["Rossi's"]);
  });
});
