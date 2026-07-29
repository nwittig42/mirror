import { loadEnv } from "@/lib/env";
import type { EngineAdapter } from "@/engines/types";
import { EngineError, engineFetch } from "@/engines/types";

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
    return {
      answer:
        candidate?.content?.parts?.map((p: { text: string }) => p.text).join("") ?? "",
      citations:
        candidate?.groundingMetadata?.groundingChunks
          ?.map((c: { web?: { uri: string } }) => c.web?.uri)
          .filter(Boolean) ?? [],
    };
  },
};
