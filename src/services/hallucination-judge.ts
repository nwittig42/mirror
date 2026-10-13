import { loadEnv } from "@/lib/env";
import { EngineError } from "@/engines/types";
import { parseJudgeOutput, parseVerdictList, type JudgeFinding, type JudgeVerdict } from "@/core/judge-parse";

// Deliberately business-neutral rather than med-spa-specific: the same engine
// is pointed at non-medical businesses (e.g. a SaaS product), and a judge told
// it was auditing "a medical aesthetics practice" grades a software company
// against medical-safety rules. The fact sheet itself supplies the domain, so
// naming the vertical here bought nothing and cost portability. Severity still
// escalates credentials and not-offered claims, which is what the med-spa
// wording was actually protecting.
//
// The rules below are written around what a run on real answers got wrong:
// about seven in ten claims the earlier prompt flagged were true. It called a
// claim wrong for agreeing with a fact in other words, for adding a feature
// the fact sheet doesn't list, and for the answer saying it couldn't find
// something. Telling a business that AI is wrong about it when AI is right
// costs more than missing an error, so every flag must name the one fact it
// cannot be true alongside, and say why.
const JUDGE_SYSTEM = `You are an accuracy auditor for a business.
You receive (1) a FACT SHEET of verified facts about the business and (2) an AI-generated ANSWER about the business.

List a claim as wrong ONLY when the claim and one fact sheet entry cannot both be true. Every wrong claim must name the one entry it conflicts with.

A claim conflicts with an entry when:
- it gives a different value for the same thing: a different price for the same plan or service, different hours, a different address, a different person in the same role, a different credential;
- it says the business offers, has, or does something that a "not_offered" entry says it does not;
- it describes the business as a different kind of business than the fact sheet does.

These are NOT conflicts. Never list them:
- A claim that agrees with an entry, in the same or in different words. "There is no app to download" agrees with an entry saying there is no mobile app.
- A claim that adds something the fact sheet does not mention: another feature, a number, an award, a partner, a piece of history. Absent from the fact sheet is not wrong.
- A narrower or broader version of an entry that can still be true with it. "A browser extension that works on LinkedIn pages" can be true alongside "has a browser extension" and alongside "does not scrape LinkedIn": working on a site is not scraping it.
- The ANSWER saying it does not know, could not find, or cannot confirm something.
- Opinions, recommendations, marketing language, and comparisons with other businesses.
- Anything the ANSWER says about a different business, including one with a similar name, when it presents it as a different business.

Test every candidate before listing it: could this claim and the entry both be true at the same time? If they could, or if you are not sure, leave it out. Calling a true statement wrong is worse than missing an error.

Severity: "critical" = credentials or qualifications of named people, safety- or compliance-relevant claims, or a service/product/capability a "not_offered" entry rules out; "major" = pricing, hours, location, or availability errors; "minor" = stale or imprecise detail.

Also list the facts the ANSWER states correctly: fact sheet entries the answer mentions and gets right. Do not list facts the answer doesn't mention.

Output ONLY a JSON object (no prose): {"wrong": [{"claim": "<verbatim or tightly paraphrased claim from the ANSWER>", "factLabel": "<the exact string after 'label:' on the conflicting fact sheet line, copied character for character>", "why": "<one sentence: what the entry says, against what the ANSWER says>", "severity": "critical|major|minor"}], "right": ["<exact label of a fact the ANSWER states correctly>"]}
Never put the category in factLabel or right. The category is a grouping; the label is the fact's name.
If there are no conflicts, "wrong" is []. If the answer states no fact correctly, "right" is [].`;

// The second opinion. Shown only a claim and the one fact it was flagged
// against, with the answer and the rest of the sheet out of sight, the model
// stops reasoning "the sheet doesn't mention this" and judges the pair.
const VERIFY_SYSTEM = `You check whether a claim about a business conflicts with a verified fact about it.
For each numbered pair, decide: can the FACT and the CLAIM both be true at the same time?
- "conflict": they cannot both be true. The claim gives a different value for the same thing (price of the same plan, hours, address, the person in a role, a credential), or says the business has or does what the fact says it does not, or describes a different kind of business.
- "compatible": they can both be true. The claim agrees with the fact, repeats it in other words, adds something the fact does not mention, leaves something out, is narrower or broader, names a specific where the fact is general, or only says that something is unknown or could not be found. A fact that lists some things does not rule out others. Working on or alongside a website is not the same as scraping it.
When unsure, answer "compatible".
Output ONLY a JSON array with one string per pair, in order, each "conflict" or "compatible".`;

async function askJudge(system: string, content: string, maxTokens: number): Promise<string> {
  const env = loadEnv();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
      "content-type": "application/json" },
    body: JSON.stringify({ model: env.JUDGE_MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content }] }),
  });
  // An EngineError, so the scan retries a rate-limited or overloaded judge
  // the same way it retries the engines, instead of losing the fact check.
  if (!res.ok) throw new EngineError("anthropic", res.status, `judge: ${await res.text()}`);
  const data = await res.json();
  return (data.content ?? []).filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text).join("");
}

/**
 * Keeps the flagged claims that still read as conflicts when each is looked
 * at next to its fact alone. If the reply can't be read, nothing is dropped:
 * the check exists to remove false alarms, not to lose findings to a parse error.
 */
async function confirmConflicts(wrong: JudgeFinding[], valueOf: Map<string, string>): Promise<JudgeFinding[]> {
  if (wrong.length === 0) return wrong;
  const pairs = wrong.map((w, i) => `${i + 1}. FACT: ${valueOf.get(w.factLabel ?? "")}\n   CLAIM: ${w.claim}`).join("\n");
  const reply = await askJudge(VERIFY_SYSTEM, pairs, 400);
  const verdicts = parseVerdictList(reply, wrong.length);
  return verdicts ? wrong.filter((_, i) => verdicts[i] === "conflict") : wrong;
}

export async function judgeAnswer(args: {
  answer: string;
  facts: { label: string; value: string; category: string }[];
}): Promise<JudgeVerdict> {
  // Rendered as explicit `label:` / `category:` / `value:` fields rather than
  // the old `- [category] label: value` shorthand. Under the shorthand the
  // judge read the bracketed category as the fact's name and returned it as
  // `factLabel`, so scan-runner's `factRows.find(f => f.label === factLabel)`
  // never matched and every finding was stored with a null factId/factValue.
  const factSheet = args.facts
    .map(f => `- label: ${f.label} | category: ${f.category} | value: ${f.value}`)
    .join("\n");
  const verdict = parseJudgeOutput(await askJudge(JUDGE_SYSTEM, `FACT SHEET:\n${factSheet}\n\nANSWER:\n${args.answer}`, 1500));
  // A conflict is with a fact. A claim the judge could not pin to an entry
  // on the sheet is, by the rules above, something the sheet doesn't cover,
  // and that is not wrong.
  const valueOf = new Map(args.facts.map(f => [f.label, f.value]));
  const pinned = verdict.wrong.filter(w => w.factLabel !== null && valueOf.has(w.factLabel));
  return { ...verdict, wrong: await confirmConflicts(pinned, valueOf) };
}
