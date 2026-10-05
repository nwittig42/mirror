import { loadEnv } from "@/lib/env";
import type { EngineAdapter } from "@/engines/types";
import { EngineError, engineFetch } from "@/engines/types";

const REDIRECT_HOST = "vertexaisearch.cloud.google.com";
const LOOKS_LIKE_DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

/**
 * Gemini hands back every source as an opaque Google redirect
 * (vertexaisearch.cloud.google.com/grounding-api-redirect/...), with the real
 * site only in `title` ("yelp.com"). Left as-is, every Gemini citation counts
 * as one Google domain and the sources report says nothing. When the title is
 * a bare domain we cite that instead; otherwise keep the redirect.
 */
function citationUrl(web: { uri?: string; title?: string } | undefined): string | undefined {
  if (!web?.uri) return undefined;
  try {
    if (new URL(web.uri).hostname === REDIRECT_HOST && web.title && LOOKS_LIKE_DOMAIN.test(web.title.trim())) {
      return `https://${web.title.trim().toLowerCase()}`;
    }
  } catch {
    return web.uri;
  }
  return web.uri;
}

export const geminiAdapter: EngineAdapter = {
  name: "gemini",
  async run(prompt) {
    const env = loadEnv();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
    const res = await engineFetch("gemini", url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { maxOutputTokens: 1500 },
      }),
    });
    if (!res.ok) throw new EngineError("gemini", res.status, await res.text());
    const data = await res.json();
    const candidate = data.candidates?.[0];
    const searchQueries: string[] = (candidate?.groundingMetadata?.webSearchQueries ?? [])
      .filter((q: unknown): q is string => typeof q === "string" && q.trim() !== "");
    return {
      searchQueries: [...new Set(searchQueries)],
      answer:
        candidate?.content?.parts?.map((p: { text: string }) => p.text).join("") ?? "",
      citations:
        candidate?.groundingMetadata?.groundingChunks
          ?.map((c: { web?: { uri?: string; title?: string } }) => citationUrl(c.web))
          .filter(Boolean) ?? [],
    };
  },
};
