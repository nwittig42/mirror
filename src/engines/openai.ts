import { loadEnv } from "@/lib/env";
import type { EngineAdapter } from "@/engines/types";
import { EngineError, engineFetch } from "@/engines/types";

export const openaiAdapter: EngineAdapter = {
  name: "openai",
  async run(prompt) {
    const env = loadEnv();
    const res = await engineFetch("openai", "https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        tools: [{ type: "web_search" }],
        input: prompt,
        max_output_tokens: 1500,
      }),
    });
    if (!res.ok) throw new EngineError("openai", res.status, await res.text());
    const data = await res.json();
    const message = data.output?.find(
      (o: { type: string }) => o.type === "message",
    );
    const content = message?.content?.[0];
    // Each web_search_call item carries the query it ran, as `action.query`
    // (and sometimes a batch as `action.queries`).
    const searchQueries: string[] = (data.output ?? [])
      .filter((o: { type: string }) => o.type === "web_search_call")
      .flatMap((o: { action?: { query?: string; queries?: string[] } }) =>
        [o.action?.query, ...(o.action?.queries ?? [])])
      .filter((q: unknown): q is string => typeof q === "string" && q.trim() !== "");
    return {
      searchQueries: [...new Set(searchQueries)],
      answer: content?.text ?? "",
      citations:
        content?.annotations
          ?.filter((a: { type: string }) => a.type === "url_citation")
          .map((a: { url: string }) => a.url) ?? [],
    };
  },
};
