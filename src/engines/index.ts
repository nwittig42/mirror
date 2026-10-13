import type { EngineAdapter } from "@/engines/types";
import { openaiAdapter } from "@/engines/openai";
import { anthropicAdapter } from "@/engines/anthropic";
import { geminiAdapter } from "@/engines/gemini";
import { perplexityAdapter } from "@/engines/perplexity";
import { grokAdapter } from "@/engines/grok";
import { googleAdapter } from "@/engines/google";
import { hasDataForSeo } from "@/engines/dataforseo";

/**
 * Engines switched off for now, from SCAN_SKIP_ENGINES (comma-separated adapter
 * names, e.g. "gemini,perplexity"). For an account that is out of credit: a
 * skipped engine is not asked at all, so its missing answers do not count
 * against the scan's coverage and block it.
 */
function skippedEngines(): Set<string> {
  return new Set((process.env.SCAN_SKIP_ENGINES ?? "").split(",").map(name => name.trim().toLowerCase()).filter(Boolean));
}

/** Every engine a scan asks. Grok and Google AI Mode are included only once their keys are set. */
export function getAdapters(): EngineAdapter[] {
  const adapters = [openaiAdapter, anthropicAdapter, geminiAdapter, perplexityAdapter];
  if (process.env.XAI_API_KEY) adapters.push(grokAdapter);
  if (hasDataForSeo()) adapters.push(googleAdapter);
  const skip = skippedEngines();
  return adapters.filter(adapter => !skip.has(adapter.name));
}
