import { loadEnv } from "@/lib/env";
import { parseDraftQuestions, type DraftQuestions } from "@/core/question-draft-parse";
import type { SitePage } from "@/services/fact-drafter";

const SYSTEM = `You write the questions a business's potential customers type into AI assistants (ChatGPT, Claude, Gemini) when looking for a business like it.
You receive the business name and text from its website.
Work out what kind of business it is and where it is. Then write exactly 10 questions:
- 5 "category" questions asking AI to recommend a business, WITHOUT naming this business, e.g. "What's the best med spa in Austin for Botox?"
- 3 "informational" questions a buyer asks before choosing, WITHOUT naming this business, e.g. "How much does lip filler cost in Austin?"
- 2 "branded" questions that DO name this business, e.g. "Is Glow MedSpa good for Botox?"
Use the services and the city the website actually mentions. Write the way real people type: short, plain, no brand-speak.
Output ONLY JSON: {"category": "<plain type of business, e.g. Med spa>", "location": "<City, State or region, or null if unclear>", "questions": [{"text": "...", "kind": "category|informational|branded"}]}`;

/**
 * Drafts the buyer questions a new prospect's scan asks, from their website.
 * Without these a prospect can't be scanned: a scan asks only its questions.
 */
export async function draftQuestionsFromPages(args: { businessName: string; pages: SitePage[] }): Promise<DraftQuestions> {
  const env = loadEnv();
  const body = args.pages
    .map(p => `PAGE: ${p.url}${p.title ? `\nTITLE: ${p.title}` : ""}\n${p.text}`)
    .join("\n\n---\n\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL, max_tokens: 1500, system: SYSTEM,
      messages: [{ role: "user", content: `BUSINESS: ${args.businessName}\n\n${body || "(the website could not be read)"}` }],
    }),
  });
  if (!res.ok) throw new Error(`question drafter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text).join("");
  return parseDraftQuestions(text);
}
