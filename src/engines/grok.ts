import { loadEnv } from "@/lib/env";
import type { EngineAdapter } from "@/engines/types";
import { EngineError, engineFetch } from "@/engines/types";

/**
 * Grok via xAI's Responses API, with both of its search tools on: the open
 * web and X (Twitter). X posts are a source no other engine reads, so they
 * show up in the sources report as their own signal.
 *
 * The response mirrors OpenAI's shape: the answer in a `message` item with
 * `url_citation` annotations, and one `*_search_call` item per search. xAI
 * also returns a top-level `citations` list, merged in here in case the
 * annotations are sparse.
 */
export const grokAdapter: EngineAdapter = {
  name: "grok",
  async run(prompt) {
    const env = loadEnv();
    const res = await engineFetch("grok", "https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.GROK_MODEL,
        input: prompt,
        tools: [{ type: "web_search" }, { type: "x_search" }],
        max_output_tokens: 1500,
      }),
    });
    if (!res.ok) throw new EngineError("grok", res.status, await res.text());
    const data = await res.json();
    const output: { type: string; content?: { text?: string; annotations?: { type: string; url?: string }[] }[];
      action?: { query?: string; queries?: string[] } }[] = data.output ?? [];

    const message = output.find(o => o.type === "message");
    const answer = (message?.content ?? []).map(c => c.text ?? "").join("");
    const annotated = (message?.content ?? [])
      .flatMap(c => c.annotations ?? [])
      .filter(a => a.type === "url_citation" && a.url)
      .map(a => a.url as string);
    const topLevel: string[] = Array.isArray(data.citations)
      ? data.citations.map((c: string | { url?: string }) => (typeof c === "string" ? c : c.url)).filter(Boolean)
      : [];
    const searchQueries = output
      .filter(o => o.type.endsWith("_search_call"))
      .flatMap(o => [o.action?.query, ...(o.action?.queries ?? [])])
      .filter((q): q is string => typeof q === "string" && q.trim() !== "");

    return {
      answer,
      citations: [...new Set([...annotated, ...topLevel])],
      searchQueries: [...new Set(searchQueries)],
    };
  },
};
