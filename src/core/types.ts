export type Engine = "openai" | "anthropic" | "gemini" | "perplexity" | "grok";
export const ENGINES: Engine[] = ["openai", "anthropic", "gemini", "perplexity", "grok"];
// Display names for the check `engine` enum, shown anywhere a customer-facing
// UI or report names the engine (answer cards, findings, the monthly report).
export const ENGINE_LABELS: Record<Engine, string> = {
  openai: "ChatGPT",
  anthropic: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
  grok: "Grok",
};
export type PromptKind = "category" | "branded" | "informational";
export type Position = "first" | "top3" | "mentioned" | "absent";
export type Severity = "critical" | "major" | "minor";
export type FindingStatus = "open" | "fixed" | "verified" | "dismissed";
export interface EngineAnswer {
  answer: string;
  citations: string[];
  /**
   * The web searches the engine ran before answering, in order. The words it
   * adds ("near me", "reviews", "2026") show what content it goes looking for.
   * Absent for engines that don't report them (Perplexity).
   */
  searchQueries?: string[];
}
export interface CheckResult {
  engine: Engine; promptId: string; promptKind: PromptKind;
  answer: string; citations: string[];
  mentioned: boolean; position: Position; competitorsMentioned: string[];
}
