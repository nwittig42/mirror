import { loadEnv } from "@/lib/env";
import type { EngineAdapter } from "@/engines/types";
import { EngineError, engineFetch } from "@/engines/types";

export const perplexityAdapter: EngineAdapter = {
  name: "perplexity",
  async run(prompt) {
    const env = loadEnv();
    const res = await engineFetch("perplexity", "https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.PERPLEXITY_MODEL,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new EngineError("perplexity", res.status, await res.text());
    const data = await res.json();
    return {
      answer: data.choices?.[0]?.message?.content ?? "",
      citations: data.citations ?? [],
    };
  },
};
