import { describe, it, expect } from "vitest";
import { topEngine } from "@/core/top-engine";

const check = (engine: string, mentioned: boolean) => ({ engine, mentioned });

describe("topEngine", () => {
  it("is the AI tool that named the business in the most answers", () => {
    expect(topEngine([check("openai", true), check("openai", true), check("anthropic", true)])).toEqual({ engine: "openai", count: 2 });
  });

  it("is null when nothing named the business, and when two tools tie for first", () => {
    expect(topEngine([check("openai", false)])).toBeNull();
    expect(topEngine([])).toBeNull();
    expect(topEngine([check("openai", true), check("anthropic", true)])).toBeNull();
  });

  it("ignores a tie further down the list", () => {
    expect(topEngine([check("openai", true), check("openai", true), check("anthropic", true), check("gemini", true)]))
      .toEqual({ engine: "openai", count: 2 });
  });
});
