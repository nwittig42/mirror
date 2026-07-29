import type { EngineAdapter } from "@/engines/types";
import { openaiAdapter } from "@/engines/openai";
import { anthropicAdapter } from "@/engines/anthropic";
import { geminiAdapter } from "@/engines/gemini";
import { perplexityAdapter } from "@/engines/perplexity";

export function getAdapters(): EngineAdapter[] {
  return [openaiAdapter, anthropicAdapter, geminiAdapter, perplexityAdapter];
}
