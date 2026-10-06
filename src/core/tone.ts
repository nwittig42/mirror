import { z } from "zod";
import { extractJsonArray } from "@/core/judge-parse";
import { highlightRanges, splitSentences } from "@/core/mention";

/**
 * How an answer describes the business. Being named is not the whole story:
 * "Harbor Plumbing is an option, though reviews mention long waits" is a
 * mention that costs the business a customer.
 */
export const TONES = ["positive", "neutral", "mixed", "negative"] as const;
export type Tone = (typeof TONES)[number];

export const TONE_LABELS: Record<Tone, string> = {
  positive: "Recommended",
  neutral: "Just listed",
  mixed: "Mixed",
  negative: "Warned against",
};

/**
 * What the rater says about one answer. `sameBusiness` and `evidence` feed
 * the namesake guard: false means the answer describes another business
 * with this name, and `evidence` is the verbatim fragment that places it
 * somewhere else or in another trade ("in Denver, CO", "a commercial HVAC
 * contractor"). Both are optional in the type so a fake rater that only
 * returns a tone still compiles; a missing value is read as null, which
 * never vetoes anything.
 */
export interface ToneRating {
  tone: Tone;
  reason: string;
  sameBusiness?: boolean | null;
  evidence?: string | null;
}

const toneSchema = z.array(z.object({
  tone: z.enum(TONES),
  reason: z.string(),
  same_business: z.boolean().nullable().optional(),
  evidence: z.string().nullable().optional(),
}));

/**
 * Parses the tone rater's `[{"tone": ..., "reason": ..., "same_business":
 * ..., "evidence": ...}]` output. The last two are optional: a model that
 * ignores them yields `sameBusiness: null`.
 */
export function parseToneOutput(raw: string): Required<ToneRating> {
  const json = extractJsonArray(raw, toneSchema);
  if (!json) throw new Error(`No tone in rater output: ${raw.slice(0, 200)}`);
  const [first] = toneSchema.parse(JSON.parse(json));
  if (!first) throw new Error("Tone rater returned an empty array");
  return {
    tone: first.tone,
    reason: first.reason.trim().slice(0, 300),
    sameBusiness: first.same_business ?? null,
    evidence: first.evidence?.trim().slice(0, 300) || null,
  };
}

// --- Namesake guard --------------------------------------------------------

/** Whitespace collapsed and case folded, so a fragment the rater quoted is found however the answer wrapped it. */
function fold(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** The part of a location before the first comma: "Portland, OR" gives "Portland". */
export function cityOf(location: string): string {
  return location.split(",")[0].trim();
}

export interface NamesakeInput {
  answer: string;
  /** The business's name and its variations. */
  practiceNames: string[];
  /** The business's location on record, "City, ST". Nothing is vetoed without one. */
  location: string | null | undefined;
  rating: ToneRating | null | undefined;
  /**
   * The other businesses known to be in play (the reconciled competitor
   * list), so the occurrence search sees the same names the record phase
   * did. Without it, "Harbor Plumbing and Rose City Plumbing both serve
   * Denver, CO" reads as one longer name, no occurrence is found, and the
   * veto never fires on an answer that classifyPosition counted as named.
   */
  others?: string[];
}

/**
 * The namesake guard. Returns the evidence fragment when the rater's "this
 * is a different business" call should veto the mention, null otherwise.
 *
 * All four must hold: a location on record, the rater saying false, the
 * evidence found verbatim in the answer (whitespace and case aside), and no
 * sentence naming the business also naming the city. Anything less and the
 * rater's opinion is ignored: a wrong veto hides a real mention, which costs
 * more than a missed namesake.
 */
export function namesakeVeto(input: NamesakeInput): string | null {
  const location = input.location?.trim() ?? "";
  const rating = input.rating;
  if (!location || !rating || rating.sameBusiness !== false) return null;
  const evidence = rating.evidence?.trim() ?? "";
  if (!evidence || !fold(input.answer).includes(fold(evidence))) return null;

  const city = fold(cityOf(location));
  const occurrences = highlightRanges(input.answer, input.practiceNames, input.others ?? []);
  if (occurrences.length === 0) return null;
  // The same sentence rule as echo detection. Every sentence that names the
  // business is checked, so "Harbor Plumbing serves Portland" anywhere in
  // the answer keeps the mention.
  const sentences = splitSentences(input.answer);
  for (const range of occurrences) {
    const sentence = sentences.find(s => range.start >= s.start && range.start < s.end);
    const text = sentence ? input.answer.slice(sentence.start, sentence.end) : input.answer;
    if (fold(text).includes(city)) return null;
  }
  return evidence;
}

export interface ToneCheck { mentioned: boolean; tone: string | null; toneReason: string | null; promptText?: string; engine?: string }

export interface ToneSummary {
  rated: number;
  counts: Record<Tone, number>;
  /** Mixed and negative answers, worst first: the ones worth reading. */
  concerns: { tone: Tone; reason: string; promptText?: string; engine?: string }[];
}

/** Tone across the answers that named the business and were rated. */
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
