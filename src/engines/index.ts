import type { EngineAdapter } from "@/engines/types";
import { openaiAdapter } from "@/engines/openai";
import { anthropicAdapter } from "@/engines/anthropic";
import { geminiAdapter } from "@/engines/gemini";
import { perplexityAdapter } from "@/engines/perplexity";
import { grokAdapter } from "@/engines/grok";
import { googleAdapter } from "@/engines/google";

/** Every engine a scan asks. Grok and Google AI Mode are included only once their keys are set. */
export function getAdapters(): EngineAdapter[] {
  const adapters = [openaiAdapter, anthropicAdapter, geminiAdapter, perplexityAdapter];
  if (process.env.XAI_API_KEY) adapters.push(grokAdapter);
  if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) adapters.push(googleAdapter);
  return adapters;
}
