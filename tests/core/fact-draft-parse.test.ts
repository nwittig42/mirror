import { describe, it, expect } from "vitest";
import { parseDraftFacts } from "@/core/fact-draft-parse";

describe("parseDraftFacts", () => {
  const pages = ["https://glow.example", "https://glow.example/pricing"];

  it("parses fenced output and normalizes categories", () => {
    const raw = "Here you go:\n```json\n" + JSON.stringify([
      { category: "Pricing", label: "Botox price", value: "$13/unit", sourceUrl: "https://glow.example/pricing" },
      { category: "not offered", label: "Surgery", value: "No surgical procedures", sourceUrl: null },
    ]) + "\n```";
    expect(parseDraftFacts(raw, pages)).toEqual([
      { category: "pricing", label: "Botox price", value: "$13/unit", sourceUrl: "https://glow.example/pricing" },
      { category: "not_offered", label: "Surgery", value: "No surgical procedures", sourceUrl: null },
    ]);
  });

  it("drops unknown categories, empty rows, repeated labels, and invented URLs", () => {
    const raw = JSON.stringify([
      { category: "vibes", label: "Mood", value: "Great" },
      { category: "services", label: " ", value: "x" },
      { category: "services", label: "Botox", value: "Offered", sourceUrl: "https://made-up.example" },
      { category: "services", label: "botox", value: "Duplicate" },
    ]);
    expect(parseDraftFacts(raw, pages)).toEqual([
      { category: "services", label: "Botox", value: "Offered", sourceUrl: null },
    ]);
  });

  it("throws when there is no array at all", () => {
    expect(() => parseDraftFacts("I could not read the site.", pages)).toThrow(/No fact array/);
  });
});
