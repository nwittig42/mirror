import { z } from "zod";

export const QUESTION_KINDS = ["category", "informational", "branded"] as const;
export const MAX_QUESTIONS = 10;

export interface DraftQuestions {
  category: string | null;
  location: string | null;
  questions: { text: string; kind: (typeof QUESTION_KINDS)[number] }[];
}

const shape = z.object({
  category: z.string().nullish(),
  location: z.string().nullish(),
  questions: z.array(z.object({ text: z.string(), kind: z.string() })).default([]),
});

/**
 * Reads the question drafter's JSON. Anything malformed gives back an empty
 * draft instead of throwing: an empty question list leaves the operator to
 * write them, which is where things stood before.
 */
export function parseDraftQuestions(raw: string): DraftQuestions {
  const empty: DraftQuestions = { category: null, location: null, questions: [] };
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) return empty;
  let data: unknown;
  try { data = JSON.parse(raw.slice(start, end + 1)); } catch { return empty; }
  const parsed = shape.safeParse(data);
  if (!parsed.success) return empty;
  const questions = parsed.data.questions
    .map(q => ({ text: q.text.trim().slice(0, 300), kind: q.kind }))
    .filter((q): q is DraftQuestions["questions"][number] =>
      q.text.length > 3 && (QUESTION_KINDS as readonly string[]).includes(q.kind))
    .slice(0, MAX_QUESTIONS);
  const clean = (s: string | null | undefined) => (s && s.trim() ? s.trim().slice(0, 100) : null);
  return { category: clean(parsed.data.category), location: clean(parsed.data.location), questions };
}
