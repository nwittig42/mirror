import { describe, it, expect } from "vitest";
import { findingKey, normalizeClaim, worseSeverity } from "@/core/finding-key";

describe("finding identity", () => {
  it("keys on the fact when there is one, ignoring wording", () => {
    expect(findingKey({ factId: "f1", claim: "Botox is $9/unit" }))
      .toBe(findingKey({ factId: "f1", claim: "They charge 9 dollars a unit" }));
  });
  it("falls back to the normalized claim", () => {
    expect(findingKey({ factId: null, claim: "Offers  LASIK surgery." }))
      .toBe(findingKey({ claim: "offers lasik surgery" }));
    expect(findingKey({ claim: "Offers LASIK" })).not.toBe(findingKey({ claim: "Offers CoolSculpting" }));
  });
  it("normalizes case, punctuation and spacing", () => {
    expect(normalizeClaim("  Botox: $9/unit!! ")).toBe("botox 9 unit");
  });
  it("picks the worse severity", () => {
    expect(worseSeverity("minor", "critical")).toBe("critical");
    expect(worseSeverity("major", "minor")).toBe("major");
  });
});
