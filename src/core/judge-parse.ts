import { z } from "zod";
import type { Severity } from "@/core/types";

export class JudgeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JudgeParseError";
  }
}

export interface JudgeFinding { claim: string; factLabel: string | null; severity: Severity }

const findingSchema = z.array(z.object({
  claim: z.string().min(1),
  factLabel: z.string().nullable(),
  severity: z.enum(["critical", "major", "minor"]),
}));

/**
 * Finds the first substring of `raw` that parses as JSON and satisfies
 * `schema`. Tries a ```json fence, then a plain fence, then a balanced-bracket
 * scan. Shared by every LLM output parser in core, since the models wrap
 * arrays in prose and fences unpredictably.
 */
export function extractJsonArray(raw: string, schema: z.ZodTypeAny = findingSchema): string | null {
  // First, try to extract from ```json ... ``` code fence
  const jsonFenceMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonFenceMatch) {
    const candidate = jsonFenceMatch[1];
    try {
      const parsed = JSON.parse(candidate);
      const validated = schema.safeParse(parsed);
      if (validated.success) return candidate;
    } catch {
      // Fall through to general scanning
    }
  }

  // Then try plain ``` fence
  const plainFenceMatch = raw.match(/```\s*([\s\S]*?)\s*```/);
  if (plainFenceMatch) {
    const candidate = plainFenceMatch[1];
    try {
      const parsed = JSON.parse(candidate);
      const validated = schema.safeParse(parsed);
      if (validated.success) return candidate;
    } catch {
      // Fall through to general scanning
    }
  }

  // Scan for balanced brackets
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '[') {
      let depth = 0;
      let inString = false;
      let j = i;

      while (j < raw.length) {
        const char = raw[j];
        const prevChar = j > 0 ? raw[j - 1] : '';

        // Handle string boundaries (toggle inString on unescaped quotes)
        if (char === '"' && prevChar !== '\\') {
          inString = !inString;
        }

        // Track bracket depth only when not in string
        if (!inString) {
          if (char === '[') depth++;
          if (char === ']') depth--;

          // When depth returns to 0, we have a balanced candidate
          if (depth === 0) {
            const candidate = raw.substring(i, j + 1);
            try {
              const parsed = JSON.parse(candidate);
              const validated = schema.safeParse(parsed);
              if (validated.success) return candidate;
            } catch {
              // Candidate didn't parse or failed schema validation, keep scanning
            }
            break;
          }
        }

        j++;
      }
    }
  }

  return null;
}

export interface JudgeVerdict { wrong: JudgeFinding[]; right: string[] }

const verdictSchema = z.object({
  wrong: findingSchema,
  right: z.array(z.string()).default([]),
});

/** First `{...}` candidate (fenced, then first-to-last brace) that is a valid verdict. */
function extractVerdict(raw: string): JudgeVerdict | null {
  const candidates = [
    raw.match(/```json\s*([\s\S]*?)\s*```/)?.[1],
    raw.match(/```\s*([\s\S]*?)\s*```/)?.[1],
    raw.includes("{") ? raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1) : undefined,
  ];
  for (const c of candidates) {
    if (!c) continue;
    try {
      const parsed = verdictSchema.safeParse(JSON.parse(c));
      if (parsed.success) return parsed.data;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/**
 * Reads the judge's `{wrong, right}` verdict. Falls back to the old bare
 * findings array (as `right: []`) so a model that ignores the new shape, or
 * prose that breaks the object, still yields the wrong facts: the array scan
 * finds the `wrong` list inside a broken object too.
 */
export function parseJudgeOutput(raw: string): JudgeVerdict {
  const verdict = extractVerdict(raw);
  if (verdict) return verdict;

  const jsonStr = extractJsonArray(raw);
  if (!jsonStr) throw new JudgeParseError(`No JSON verdict in judge output: ${raw.slice(0, 200)}`);
  const parsed = findingSchema.safeParse(JSON.parse(jsonStr));
  if (!parsed.success) throw new JudgeParseError(parsed.error.message);
  return { wrong: parsed.data, right: [] };
}
