import { loadEnv } from "@/lib/env";
import { parseJudgeOutput, type JudgeFinding } from "@/core/judge-parse";

// Deliberately business-neutral rather than med-spa-specific: the same engine
// is pointed at non-medical businesses (e.g. a SaaS product), and a judge told
// it was auditing "a medical aesthetics practice" grades a software company
// against medical-safety rules. The fact sheet itself supplies the domain, so
// naming the vertical here bought nothing and cost portability. Severity still
// escalates credentials and not-offered claims, which is what the med-spa
// wording was actually protecting.
const JUDGE_SYSTEM = `You are an accuracy auditor for a business.
You receive (1) a FACT SHEET of verified facts about the business and (2) an AI-generated ANSWER about the business.
Identify every claim in the ANSWER that CONTRADICTS a fact sheet entry, or asserts a service, product, capability, credential, or price the fact sheet's "not_offered" or other entries rule out.
Do NOT flag: omissions, vague marketing language, information absent from the fact sheet, or subjective opinions.
Severity rules: "critical" = credentials or qualifications of named people, safety- or compliance-relevant claims, or a service/product/capability the business does not offer; "major" = pricing, hours, location, or availability errors; "minor" = stale or imprecise detail.
Output ONLY a JSON array (no prose): [{"claim": "<verbatim or tightly paraphrased claim from the ANSWER>", "factLabel": "<the exact string after 'label:' on the contradicted fact sheet line, copied character for character, or null>", "severity": "critical|major|minor"}]
Never put the category in factLabel. The category is a grouping; the label is the fact's name.
If there are no contradictions output [].`;

export async function judgeAnswer(args: {
  answer: string;
  facts: { label: string; value: string; category: string }[];
}): Promise<JudgeFinding[]> {
  const env = loadEnv();
  // Rendered as explicit `label:` / `category:` / `value:` fields rather than
  // the old `- [category] label: value` shorthand. Under the shorthand the
  // judge read the bracketed category as the fact's name and returned it as
  // `factLabel`, so scan-runner's `factRows.find(f => f.label === factLabel)`
  // never matched and every finding was stored with a null factId/factValue.
  const factSheet = args.facts
    .map(f => `- label: ${f.label} | category: ${f.category} | value: ${f.value}`)
    .join("\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
      "content-type": "application/json" },
    body: JSON.stringify({
      model: env.JUDGE_MODEL, max_tokens: 1000, system: JUDGE_SYSTEM,
      messages: [{ role: "user", content: `FACT SHEET:\n${factSheet}\n\nANSWER:\n${args.answer}` }],
    }),
  });
  if (!res.ok) throw new Error(`judge ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text).join("");
  return parseJudgeOutput(text);
}
