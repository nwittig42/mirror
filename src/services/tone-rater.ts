import { loadEnv } from "@/lib/env";
import { parseToneOutput, type Tone } from "@/core/tone";

const TONE_SYSTEM = `You rate how an AI-generated ANSWER describes one business, named under BUSINESS.
Judge only what the answer says about that business, not about others.
- "positive": recommended, praised, or presented as a top or strong choice
- "neutral": listed or mentioned without a clear recommendation either way
- "mixed": recommended with a real caveat (price, wait times, reviews, limits)
- "negative": warned against, criticized, or presented as a poor choice
Output ONLY a JSON array with one object: [{"tone": "positive|neutral|mixed|negative", "reason": "<one short sentence quoting or paraphrasing what the answer said about the business>"}]`;

/**
 * Rates the tone of one answer that names the practice. Uses the cheap judge
 * model: roughly a tenth of a cent per answer.
 */
export async function rateTone(args: { answer: string; businessNames: string[] }): Promise<{ tone: Tone; reason: string }> {
  const env = loadEnv();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
      "content-type": "application/json" },
    body: JSON.stringify({
      model: env.JUDGE_MODEL, max_tokens: 200, system: TONE_SYSTEM,
      messages: [{ role: "user", content: `BUSINESS:\n${args.businessNames.join("\n")}\n\nANSWER:\n${args.answer}` }],
    }),
  });
  if (!res.ok) throw new Error(`tone ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text).join("");
  return parseToneOutput(text);
}
