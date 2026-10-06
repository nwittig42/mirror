import { describe, it, expect } from "vitest";
import { slugify, uniqueSlug } from "@/core/slug";

describe("slugs", () => {
  it("turns a name into a clean web address", () => {
    expect(slugify("Glow MedSpa & Wellness!")).toBe("glow-medspa-wellness");
    expect(slugify("Café Élan")).toBe("cafe-elan");
  });
  it("never returns an empty slug", () => {
    // The fallback can surface in a URL, so it follows the section 8 vocabulary
    // of the 2026-10-05 spec ("business", never "practice").
    expect(slugify("!!!")).toBe("business");
  });
  it("adds -2, -3… when the address is taken", () => {
    expect(uniqueSlug("Glow MedSpa", new Set(["glow-medspa"]))).toBe("glow-medspa-2");
    expect(uniqueSlug("Glow MedSpa", new Set(["glow-medspa", "glow-medspa-2"]))).toBe("glow-medspa-3");
    expect(uniqueSlug("Glow MedSpa", new Set())).toBe("glow-medspa");
  });
});
