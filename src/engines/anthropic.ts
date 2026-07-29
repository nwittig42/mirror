import { loadEnv } from "@/lib/env";
import type { EngineAdapter } from "@/engines/types";
import { EngineError, engineFetch } from "@/engines/types";

export const anthropicAdapter: EngineAdapter = {
  name: "anthropic",
  async run(prompt) {
    const env = loadEnv();
    const res = await engineFetch("anthropic", "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new EngineError("anthropic", res.status, await res.text());
    const data = await res.json();
    const blocks = data.content ?? [];
    const answer = blocks
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("");
    const allUrls: string[] = blocks.flatMap(
      (b: { citations?: { url: string }[] }) => (b.citations ?? []).map((c) => c.url),
    );
    const citations: string[] = [...new Set(allUrls)].filter(Boolean);
    return { answer, citations };
  },
};
