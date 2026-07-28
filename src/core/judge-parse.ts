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

function extractJsonArray(raw: string): string | null {
  // First, try to extract from ```json ... ``` code fence
  const jsonFenceMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonFenceMatch) {
    const candidate = jsonFenceMatch[1];
    try {
      const parsed = JSON.parse(candidate);
      const validated = findingSchema.safeParse(parsed);
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
      const validated = findingSchema.safeParse(parsed);
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
              const validated = findingSchema.safeParse(parsed);
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

export function parseJudgeOutput(raw: string): JudgeFinding[] {
  const jsonStr = extractJsonArray(raw);
  if (!jsonStr) throw new JudgeParseError(`No JSON array in judge output: ${raw.slice(0, 200)}`);

  let data: unknown;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    throw new JudgeParseError("Judge output is not valid JSON");
  }

  const parsed = findingSchema.safeParse(data);
  if (!parsed.success) throw new JudgeParseError(parsed.error.message);
  return parsed.data;
}
