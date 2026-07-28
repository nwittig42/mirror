import { z } from "zod";
import type { Severity } from "@/core/types";

export class JudgeParseError extends Error {}
export interface JudgeFinding { claim: string; factLabel: string | null; severity: Severity }

const findingSchema = z.array(z.object({
  claim: z.string().min(1),
  factLabel: z.string().nullable(),
  severity: z.enum(["critical", "major", "minor"]),
}));

export function parseJudgeOutput(raw: string): JudgeFinding[] {
  const match = raw.match(/\[[\s\S]*\]/);   // grab outermost JSON array
  if (!match) throw new JudgeParseError(`No JSON array in judge output: ${raw.slice(0, 200)}`);
  let data: unknown;
  try { data = JSON.parse(match[0]); }
  catch { throw new JudgeParseError("Judge output is not valid JSON"); }
  const parsed = findingSchema.safeParse(data);
  if (!parsed.success) throw new JudgeParseError(parsed.error.message);
  return parsed.data;
}
