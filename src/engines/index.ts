import type { EngineAdapter } from "@/engines/types";
import { openaiAdapter } from "@/engines/openai";
import { anthropicAdapter } from "@/engines/anthropic";
import { geminiAdapter } from "@/engines/gemini";
import { perplexityAdapter } from "@/engines/perplexity";
import { grokAdapter } from "@/engines/grok";

/** Every engine a scan asks. Grok is included only once its key is set. */
export function getAdapters(): EngineAdapter[] {
  const adapters = [openaiAdapter, anthropicAdapter, geminiAdapter, perplexityAdapter];
  if (process.env.XAI_API_KEY) adapters.push(grokAdapter);
  return adapters;
}
