import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AnswerCard } from "@/components/answer-card";

/**
 * The answer card highlights the business's name with the same matcher the
 * scan used to classify the check, so the highlight agrees with the position
 * chip. A review found the card ignoring the other businesses the check
 * found: without them, "Harbor Plumbing & Rose City Plumbing" reads as one
 * longer name and nothing is marked.
 */
const render = (props: Partial<Parameters<typeof AnswerCard>[0]>) =>
  renderToStaticMarkup(
    <AnswerCard
      promptText="Who is the best plumber in Portland?"
      engine="openai"
      position="first"
      answerText="Top picks: Harbor Plumbing & Rose City Plumbing."
      citations={[]}
      practiceNames={["Harbor Plumbing"]}
      {...props}
    />,
  );

const marks = (html: string) => [...html.matchAll(/<mark[^>]*>([^<]*)<\/mark>/g)].map(m => m[1]);

describe("AnswerCard highlight and the other businesses in the answer", () => {
  it("marks the name once the competitor after 'and' is known", () => {
    expect(marks(render({ others: ["Rose City Plumbing"] }))).toEqual(["Harbor Plumbing"]);
  });

  it("marks nothing when the competitor is not passed, as the longer-name guard reads it", () => {
    expect(marks(render({}))).toEqual([]);
  });

  it("still marks a plain mention with no conjunction, others or not", () => {
    const text = "Harbor Plumbing is the one I would call.";
    expect(marks(render({ answerText: text }))).toEqual(["Harbor Plumbing"]);
    expect(marks(render({ answerText: text, others: ["Rose City Plumbing"] }))).toEqual(["Harbor Plumbing"]);
  });

  it("never marks a genuinely longer name, even with others passed", () => {
    // "Harbor Plumbing and Heating" is a different business; the known
    // competitor list does not rescue it.
    const text = "Harbor Plumbing and Heating is the one I would call.";
    expect(marks(render({ answerText: text, others: ["Rose City Plumbing"] }))).toEqual([]);
  });
});
