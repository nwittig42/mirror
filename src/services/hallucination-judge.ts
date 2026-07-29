import { loadEnv } from "@/lib/env";
import { parseJudgeOutput, type JudgeFinding } from "@/core/judge-parse";

const JUDGE_SYSTEM = `You are an accuracy auditor for a medical aesthetics practice.
You receive (1) a FACT SHEET of verified facts about the practice and (2) an AI-generated ANSWER about the practice.
Identify every claim in the ANSWER that CONTRADICTS a fact sheet entry, or asserts a service/credential/price the fact sheet's "not_offered" or other entries rule out.
Do NOT flag: omissions, vague marketing language, information absent from the fact sheet, or subjective opinions.
Severity rules: "critical" = provider credentials, medical safety, or a service the practice does not offer; "major" = pricing, hours, or location errors; "minor" = stale or imprecise detail.
Output ONLY a JSON array (no prose): [{"claim": "<verbatim or tightly paraphrased claim from the ANSWER>", "factLabel": "<label of the contradicted fact, or null>", "severity": "critical|major|minor"}]
If there are no contradictions output [].`;

export async function judgeAnswer(args: {
  answer: string;
  facts: { label: string; value: string; category: string }[];
}): Promise<JudgeFinding[]> {
  const env = loadEnv();
  const factSheet = args.facts.map(f => `- [${f.category}] ${f.label}: ${f.value}`).join("\n");
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
