import { describe, it, expect } from "vitest";
import { parseJudgeOutput, JudgeParseError, parseVerdictList } from "@/core/judge-parse";

describe("parseJudgeOutput", () => {
  it("parses a clean JSON array", () => {
    const raw = `[{"claim":"Botox costs $9/unit","factLabel":"Botox price","severity":"major"}]`;
    expect(parseJudgeOutput(raw).wrong).toEqual([
      { claim: "Botox costs $9/unit", factLabel: "Botox price", severity: "major" }]);
  });
  it("strips code fences and surrounding prose", () => {
    const raw = "Here are the contradictions:\n```json\n[{\"claim\":\"x\",\"factLabel\":null,\"severity\":\"critical\"}]\n```";
    expect(parseJudgeOutput(raw).wrong).toHaveLength(1);
  });
  it("returns [] for the literal empty array", () =>
    expect(parseJudgeOutput("[]")).toEqual({ wrong: [], right: [] }));
  it("rejects invalid severities", () =>
    expect(() => parseJudgeOutput(`[{"claim":"x","factLabel":null,"severity":"huge"}]`))
      .toThrow(JudgeParseError));
  it("ignores trailing prose with brackets", () => {
    const raw = '```json\n[{"claim":"x","factLabel":null,"severity":"minor"}]\n```\nSee reference [1] for details.';
    expect(parseJudgeOutput(raw).wrong).toHaveLength(1);
  });
  it("ignores scratch list before answer", () => {
    const raw = 'Scratch: [1,2,3]\nFinal:\n[{"claim":"y","factLabel":null,"severity":"major"}]';
    expect(parseJudgeOutput(raw).wrong).toHaveLength(1);
  });
  it("handles embedded brackets in claim strings", () => {
    const raw = '[{"claim":"arr[0] is common","factLabel":null,"severity":"minor"}]';
    expect(parseJudgeOutput(raw).wrong).toHaveLength(1);
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

describe("parseJudgeOutput verdict object", () => {
  it("parses wrong and right", () => {
    const raw = `{"wrong":[{"claim":"Botox is $9","factLabel":"Botox price","severity":"major"}],"right":["Sunday hours"]}`;
    expect(parseJudgeOutput(raw)).toEqual({
      wrong: [{ claim: "Botox is $9", factLabel: "Botox price", severity: "major" }],
      right: ["Sunday hours"],
    });
  });
  it("accepts a fenced object with prose around it", () => {
    const raw = "Here you go:\n```json\n{\"wrong\":[],\"right\":[\"Address\"]}\n```\nDone.";
    expect(parseJudgeOutput(raw)).toEqual({ wrong: [], right: ["Address"] });
  });
  it("treats the old bare array as wrong-only", () => {
    const raw = `[{"claim":"x","factLabel":null,"severity":"minor"}]`;
    expect(parseJudgeOutput(raw)).toEqual({ wrong: [{ claim: "x", factLabel: null, severity: "minor" }], right: [] });
  });
  it("defaults a missing right list to empty", () => {
    expect(parseJudgeOutput(`{"wrong":[]}`)).toEqual({ wrong: [], right: [] });
  });
  it("still finds the wrong list when prose breaks the object", () => {
    const raw = `Note {draft} then {"wrong":[{"claim":"y","factLabel":null,"severity":"major"}],"right":[]}`;
    expect(parseJudgeOutput(raw).wrong).toHaveLength(1);
  });
});

describe("parseVerdictList", () => {
  it("reads one verdict per flagged claim, fenced or bare", () => {
    expect(parseVerdictList(`["conflict","compatible"]`, 2)).toEqual(["conflict", "compatible"]);
    expect(parseVerdictList("```json\n[\"compatible\"]\n```", 1)).toEqual(["compatible"]);
  });
  it("is null for anything that is not exactly that list, so nothing is dropped on a bad reply", () => {
    expect(parseVerdictList(`["conflict"]`, 2)).toBeNull();
    expect(parseVerdictList(`["conflict","maybe"]`, 2)).toBeNull();
    expect(parseVerdictList("The first pair conflicts.", 1)).toBeNull();
  });
  it("keeps the reason the judge gave for a finding", () => {
    const raw = `{"wrong":[{"claim":"x","factLabel":"Botox price","why":"$13 against $9","severity":"major"}],"right":[]}`;
    expect(parseJudgeOutput(raw).wrong[0].why).toBe("$13 against $9");
  });
});
