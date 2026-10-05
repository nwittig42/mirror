import { z } from "zod";
import { extractJsonArray } from "@/core/judge-parse";

/**
 * How an answer describes the practice. Being named is not the whole story:
 * "Glow MedSpa is an option, though reviews mention long waits" is a mention
 * that costs the practice a customer.
 */
export const TONES = ["positive", "neutral", "mixed", "negative"] as const;
export type Tone = (typeof TONES)[number];

export const TONE_LABELS: Record<Tone, string> = {
  positive: "Recommended",
  neutral: "Just listed",
  mixed: "Mixed",
  negative: "Warned against",
};

const toneSchema = z.array(z.object({ tone: z.enum(TONES), reason: z.string() }));

/** Parses the tone rater's `[{"tone": ..., "reason": ...}]` output. */
export function parseToneOutput(raw: string): { tone: Tone; reason: string } {
  const json = extractJsonArray(raw, toneSchema);
  if (!json) throw new Error(`No tone in rater output: ${raw.slice(0, 200)}`);
  const [first] = toneSchema.parse(JSON.parse(json));
  if (!first) throw new Error("Tone rater returned an empty array");
  return { tone: first.tone, reason: first.reason.trim().slice(0, 300) };
}

export interface ToneCheck { mentioned: boolean; tone: string | null; toneReason: string | null; promptText?: string; engine?: string }

export interface ToneSummary {
  rated: number;
  counts: Record<Tone, number>;
  /** Mixed and negative answers, worst first: the ones worth reading. */
  concerns: { tone: Tone; reason: string; promptText?: string; engine?: string }[];
}

/** Tone across the answers that named the practice and were rated. */
export function summarizeTone(checks: ToneCheck[]): ToneSummary {
  const counts: Record<Tone, number> = { positive: 0, neutral: 0, mixed: 0, negative: 0 };
  const concerns: ToneSummary["concerns"] = [];
  let rated = 0;
  for (const c of checks) {
    if (!c.mentioned || !c.tone || !(TONES as readonly string[]).includes(c.tone)) continue;
    const tone = c.tone as Tone;
    rated++;
    counts[tone]++;
    if (tone === "mixed" || tone === "negative") {
      concerns.push({ tone, reason: c.toneReason ?? "", promptText: c.promptText, engine: c.engine });
    }
  }
  concerns.sort((a, b) => Number(b.tone === "negative") - Number(a.tone === "negative"));
  return { rated, counts, concerns };
}
