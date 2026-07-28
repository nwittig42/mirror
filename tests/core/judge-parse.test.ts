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
  it("ignores trailing prose with brackets", () => {
    const raw = '```json\n[{"claim":"x","factLabel":null,"severity":"minor"}]\n```\nSee reference [1] for details.';
    expect(parseJudgeOutput(raw)).toHaveLength(1);
  });
  it("ignores scratch list before answer", () => {
    const raw = 'Scratch: [1,2,3]\nFinal:\n[{"claim":"y","factLabel":null,"severity":"major"}]';
    expect(parseJudgeOutput(raw)).toHaveLength(1);
  });
  it("handles embedded brackets in claim strings", () => {
    const raw = '[{"claim":"arr[0] is common","factLabel":null,"severity":"minor"}]';
    expect(parseJudgeOutput(raw)).toHaveLength(1);
  });
  it("error has correct name property", () => {
    try {
      parseJudgeOutput("no array here");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(JudgeParseError);
      expect((err as JudgeParseError).name).toBe("JudgeParseError");
    }
  });
});
