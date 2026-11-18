import { describe, it, expect } from "vitest";
import { quickAdapters, quickToolsLabel, QUICK_ENGINES } from "@/services/quick-scan";
import type { EngineAdapter } from "@/engines/types";

const adapter = (name: EngineAdapter["name"]): EngineAdapter => ({ name, run: async () => ({ answer: "", citations: [] }) });

describe("quickAdapters", () => {
  it("keeps only ChatGPT and Claude, in that order", () => {
    const all = [adapter("grok"), adapter("anthropic"), adapter("google"), adapter("openai")];
    expect(quickAdapters(all).map(a => a.name)).toEqual(["openai", "anthropic"]);
    expect([...QUICK_ENGINES]).toEqual(["openai", "anthropic"]);
  });

  it("is empty when both are switched off", () => {
    expect(quickAdapters([adapter("grok"), adapter("google")])).toEqual([]);
  });
});

describe("quickToolsLabel", () => {
  it("labels the tools actually asked", () => {
    expect(quickToolsLabel([adapter("openai"), adapter("anthropic"), adapter("grok")])).toBe("ChatGPT and Claude");
    expect(quickToolsLabel([adapter("anthropic"), adapter("grok")])).toBe("Claude");
    expect(quickToolsLabel([adapter("openai")])).toBe("ChatGPT");
    expect(quickToolsLabel([adapter("grok")])).toBe("");
  });
});
