import { describe, it, expect } from "vitest";
import { parseDraftQuestions } from "@/core/question-draft-parse";

const good = {
  category: "Med spa", location: "Austin, TX",
  questions: [
    { text: "Best med spa in Austin for Botox?", kind: "category" },
    { text: "How much does Botox cost in Austin?", kind: "informational" },
    { text: "Is Glow MedSpa any good?", kind: "branded" },
  ],
};

describe("parseDraftQuestions", () => {
  it("reads category, location and questions, even wrapped in prose", () => {
    expect(parseDraftQuestions(`Here:\n${JSON.stringify(good)}\nDone`)).toEqual(good);
  });
  it("drops questions with an unknown kind or blank text, and keeps at most 10", () => {
    const many = { ...good, questions: [
      ...Array.from({ length: 12 }, (_, i) => ({ text: `Question ${i}?`, kind: "category" })),
      { text: "x", kind: "weird" }, { text: "   ", kind: "category" },
    ] };
    const out = parseDraftQuestions(JSON.stringify(many));
    expect(out.questions).toHaveLength(10);
    expect(out.questions.every(q => q.kind === "category")).toBe(true);
  });
  it("gives back nothing rather than throwing on garbage", () => {
    expect(parseDraftQuestions("not json")).toEqual({ category: null, location: null, questions: [] });
  });
});
