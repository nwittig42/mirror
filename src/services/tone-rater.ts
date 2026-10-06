import { loadEnv } from "@/lib/env";
import { parseToneOutput, type ToneRating } from "@/core/tone";

const TONE_SYSTEM = `You rate how an AI-generated ANSWER describes one business, named under BUSINESS.
Judge only what the answer says about that business, not about others.
- "positive": recommended, praised, or presented as a top or strong choice
- "neutral": listed or mentioned without a clear recommendation either way
- "mixed": recommended with a real caveat (price, wait times, reviews, limits)
- "negative": warned against, criticized, or presented as a poor choice
Business names collide, so also say whether the answer is about this business or about another one with the same name. BUSINESS may list its CATEGORY, LOCATION and WEBSITE.
- "same_business": false when the answer places the business in another city or region, in another trade, or at another website; true when it fits what BUSINESS says or the answer gives no reason to doubt it; null when you cannot tell.
- "evidence": only when same_business is false, the exact fragment of the answer that shows it, copied word for word (for example "in Denver, CO" or "a commercial HVAC contractor"); otherwise null.
Output ONLY a JSON array with one object: [{"tone": "positive|neutral|mixed|negative", "reason": "<one short sentence quoting or paraphrasing what the answer said about the business>", "same_business": true|false|null, "evidence": "<verbatim fragment>"|null}]`;

export interface ToneRaterInput {
  answer: string;
  /** The business's name and its variations. */
  businessNames: string[];
  /** What is on record for the business; a line is sent only when it is set. */
  context?: { category?: string | null; location?: string | null; website?: string | null };
}

/**
 * Rates the tone of one answer that names the business, and whether it is
 * this business or a namesake. Uses the cheap judge model: roughly a tenth
 * of a cent per answer.
 */
export async function rateTone(args: ToneRaterInput): Promise<ToneRating> {
  const env = loadEnv();
  const details = ([
    ["CATEGORY", args.context?.category], ["LOCATION", args.context?.location], ["WEBSITE", args.context?.website],
  ] as const).flatMap(([key, value]) => (value?.trim() ? [`${key}: ${value.trim()}`] : []));
  const business = [...args.businessNames, ...details].join("\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
      "content-type": "application/json" },
    body: JSON.stringify({
      model: env.JUDGE_MODEL, max_tokens: 300, system: TONE_SYSTEM,
      messages: [{ role: "user", content: `BUSINESS:\n${business}\n\nANSWER:\n${args.answer}` }],
    }),
  });
  if (!res.ok) throw new Error(`tone ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text).join("");
  return parseToneOutput(text);
}
