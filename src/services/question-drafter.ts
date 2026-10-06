import { loadEnv } from "@/lib/env";
import { parseDraftQuestions, type DraftQuestions } from "@/core/question-draft-parse";
import type { SitePage } from "@/services/fact-drafter";

// Every example names a city, and the model is told to do the same, because
// the engine adapters send no user location: a question that leans on where
// the reader is would be answered for nowhere in particular, never for this
// business's area.
const SYSTEM = `You write the questions a business's potential customers type into AI assistants (ChatGPT, Claude, Gemini) when looking for a business like it.
You receive the business name and text from its website. You may also be told what kind of business it is and where it is; when you are, those are facts: use them as given and do not second-guess them from the website. Work out from the website whatever you were not told.
Then write exactly 10 questions:
- 5 "category" questions asking AI to recommend a business, WITHOUT naming this business. Among the five: one that names the city or area ("What are the best plumbers in Portland, OR?"), one asking for the best option for a specific service the website offers ("Which bakery in Portland does the best custom wedding cakes?"), and one comparison ("Who should I go to for Botox in Austin?").
- 3 "informational" questions a buyer asks before choosing, WITHOUT naming this business, e.g. "How much does a water heater replacement cost in Portland?", "How far ahead do I need to order a custom cake in Portland?", "How long does Botox take to work?"
- 2 "branded" questions that DO name this business, e.g. "Is Harbor Plumbing good for drain cleaning?", "What do people say about Rose City Bakery?", "Is Glow MedSpa good for Botox?"
Every question that depends on place names the city or area in words. Never write a question that leans on where the reader is: the assistant is not told where they are, so it could not answer about this business's area.
Use the services and the place the website actually mentions, or the facts you were given. Write the way real people type: short, plain, no brand-speak.
Output ONLY JSON: {"category": "<plain type of business, e.g. Plumber, Bakery, Med spa>", "location": "<City, State or region, or null if unclear>", "questions": [{"text": "...", "kind": "category|informational|branded"}]}
Repeat any category or location you were given exactly; fill in from the website only what you were not told, and use null for a location you cannot tell.`;

export interface DraftQuestionsInput {
  businessName: string;
  pages: SitePage[];
  /** What kind of business it is, when the prospect said; authoritative over the model's guess. */
  category?: string | null;
  /** Where it is, when the prospect said; authoritative over the model's guess. */
  location?: string | null;
}

/**
 * What the prospect told us, stated as fact so the model builds on it instead
 * of guessing from the website. Nothing when they said nothing.
 */
function statedFacts(category?: string | null, location?: string | null): string | null {
  const c = category?.trim();
  const l = location?.trim();
  if (!c && !l) return null;
  if (!c) return `The business is in ${l}.`;
  const article = /^[aeiou]/i.test(c) ? "an" : "a";
  return l ? `The business is ${article} ${c} in ${l}.` : `The business is ${article} ${c}.`;
}

/**
 * Drafts the buyer questions a new prospect's scan asks, from their website
 * and whatever they said about the business on /book. Without these a
 * prospect can't be scanned: a scan asks only its questions.
 */
export async function draftQuestionsFromPages(args: DraftQuestionsInput): Promise<DraftQuestions> {
  const env = loadEnv();
  const body = args.pages
    .map(p => `PAGE: ${p.url}${p.title ? `\nTITLE: ${p.title}` : ""}\n${p.text}`)
    .join("\n\n---\n\n");
  const facts = statedFacts(args.category, args.location);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL, max_tokens: 1500, system: SYSTEM,
      messages: [{ role: "user", content:
        `BUSINESS: ${args.businessName}${facts ? `\n${facts}` : ""}\n\n${body || "(the website could not be read)"}` }],
    }),
  });
  if (!res.ok) throw new Error(`question drafter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text).join("");
  return parseDraftQuestions(text);
}
