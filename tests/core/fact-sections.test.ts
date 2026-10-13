import { describe, it, expect } from "vitest";
import { cleanSection, groupBySection, sectionOf } from "@/core/fact-sections";

describe("fact sheet sections", () => {
  it("tidies a heading and treats an empty one as none", () => {
    expect(cleanSection("  Custom   cakes \n")).toBe("Custom cakes");
    expect(cleanSection("   ")).toBeNull();
    expect(cleanSection(null)).toBeNull();
    expect(cleanSection("x".repeat(60))!.length).toBe(40);
  });

  it("uses the chosen heading, and a default for the fact's type when there is none", () => {
    expect(sectionOf({ section: "Allergens", category: "services" })).toBe("Allergens");
    expect(sectionOf({ section: null, category: "pricing" })).toBe("Prices");
    expect(sectionOf({ section: "  ", category: "not_offered" })).toBe("Not offered");
  });

  it("groups in the order headings first appear, merging headings that differ only by capitals", () => {
    const groups = groupBySection([
      { id: 1, section: "Menu", category: "services" as const },
      { id: 2, section: "Hours", category: "logistics" as const },
      { id: 3, section: "menu", category: "pricing" as const },
      { id: 4, section: null, category: "pricing" as const },
    ]);
    expect(groups.map(g => [g.title, g.facts.map(f => f.id)])).toEqual([
      ["Menu", [1, 3]],
      ["Hours", [2]],
      ["Prices", [4]],
    ]);
  });
});
