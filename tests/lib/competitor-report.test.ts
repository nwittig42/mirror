import { describe, it, expect } from "vitest";
import { buildCompetitorReport } from "@/lib/competitor-report";

const practice = "Glow MedSpa";
const check = (promptText: string, engine: "openai" | "perplexity" | "gemini" | "anthropic", namedOrder: string[]) =>
  ({ promptText, engine, namedOrder, mentioned: namedOrder.includes(practice) });

describe("buildCompetitorReport", () => {
  const checks = [
    check("Best med spa in Santa Monica", "openai", ["Nuvo Aesthetics", practice, "Skin Bar LA"]),
    check("Best med spa in Santa Monica", "perplexity", ["Skin Bar LA"]),
    check("Where to get Botox", "openai", [practice]),
    check("Where to get Botox", "perplexity", []),
  ];

  it("ranks every business by how many answers named it, practice included", () => {
    const report = buildCompetitorReport(checks, [practice]);
    expect(report.totalChecks).toBe(4);
    expect(report.shareOfVoice).toEqual([
      { name: practice, mentions: 2, isPractice: true },
      { name: "Skin Bar LA", mentions: 2, isPractice: false },
      { name: "Nuvo Aesthetics", mentions: 1, isPractice: false },
    ]);
  });

  it("always lists the practice, even when no answer named it", () => {
    const report = buildCompetitorReport([check("Best med spa", "openai", ["Skin Bar LA"])], [practice]);
    expect(report.shareOfVoice).toContainEqual({ name: practice, mentions: 0, isPractice: true });
  });

  it("builds one row per question with a cell per engine that answered", () => {
    const report = buildCompetitorReport(checks, [practice]);
    expect(report.engines).toEqual(["openai", "perplexity"]);
    expect(report.rows).toHaveLength(2);
    expect(report.rows[0].promptText).toBe("Best med spa in Santa Monica");
    expect(report.rows[0].cells.openai).toEqual({ names: ["Nuvo Aesthetics", practice, "Skin Bar LA"], practiceIndex: 1 });
    expect(report.rows[0].cells.perplexity).toEqual({ names: ["Skin Bar LA"], practiceIndex: -1 });
    expect(report.rows[1].cells.perplexity).toEqual({ names: [], practiceIndex: -1 });
  });

  it("leaves the cell undefined when an engine never answered that question", () => {
    const report = buildCompetitorReport([check("Best med spa", "openai", [practice])], [practice]);
    expect(report.engines).toEqual(["openai"]);
    expect(report.rows[0].cells.gemini).toBeUndefined();
  });

  it("recognises the practice under any of its name variations", () => {
    const report = buildCompetitorReport([check("Best med spa", "openai", ["Glow Med Spa"])], [practice, "Glow Med Spa"]);
    expect(report.rows[0].cells.openai?.practiceIndex).toBe(0);
    expect(report.shareOfVoice[0]).toEqual({ name: practice, mentions: 1, isPractice: true });
  });
});
