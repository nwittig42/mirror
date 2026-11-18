import { getAdapters } from "@/engines";
import type { EngineAdapter } from "@/engines/types";

/**
 * The quick first look a new audit runs before its full scan: two tools,
 * each question asked once, every ask sent together, so a visitor has a
 * result in a minute or two. The full scan follows and replaces it.
 */
export const QUICK_ENGINES = ["openai", "anthropic"] as const;

/** No new ask starts this long into the quick scan. */
export const QUICK_START_BUDGET_MS = 45_000;
/** The quick scan stops waiting here and records what came back. */
export const QUICK_HARD_STOP_MS = 75_000;

const DISPLAY: Record<(typeof QUICK_ENGINES)[number], string> = { openai: "ChatGPT", anthropic: "Claude" };

/** The quick tools among `all`, in the quick order. Empty when both are switched off. */
export function quickAdapters(all: EngineAdapter[]): EngineAdapter[] {
  return QUICK_ENGINES.flatMap(name => all.filter(adapter => adapter.name === name));
}

/** The quick tools actually asked, as a visitor reads them: "ChatGPT and Claude". Empty when there are none. */
export function quickToolsLabel(all: EngineAdapter[] = getAdapters()): string {
  return quickAdapters(all).map(a => DISPLAY[a.name as (typeof QUICK_ENGINES)[number]]).join(" and ");
}
