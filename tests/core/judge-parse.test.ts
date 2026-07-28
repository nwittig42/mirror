import { describe, it, expect } from "vitest";
import { parseJudgeOutput, JudgeParseError } from "@/core/judge-parse";

describe("parseJudgeOutput", () => {
  it("parses a clean JSON array", () => {
    const raw = `[{"claim":"Botox costs $9/unit","factLabel":"Botox price","severity":"major"}]`;
    expect(parseJudgeOutput(raw)).toEqual([
      { claim: "Botox costs $9/unit", factLabel: "Botox price", severity: "major" }]);
  });
  it("strips code fences and surrounding prose", () => {
    const raw = "Here are the contradictions:\n```json\n[{\"claim\":\"x\",\"factLabel\":null,\"severity\":\"critical\"}]\n```";
    expect(parseJudgeOutput(raw)).toHaveLength(1);
  });
  it("returns [] for the literal empty array", () =>
    expect(parseJudgeOutput("[]")).toEqual([]));
  it("rejects invalid severities", () =>
    expect(() => parseJudgeOutput(`[{"claim":"x","factLabel":null,"severity":"huge"}]`))
      .toThrow(JudgeParseError));
});
