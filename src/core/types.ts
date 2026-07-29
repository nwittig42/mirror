export type Engine = "openai" | "anthropic" | "gemini" | "perplexity";
export const ENGINES: Engine[] = ["openai", "anthropic", "gemini", "perplexity"];
// Display names for the check `engine` enum, shown anywhere a patient-facing
// UI or report names the engine (answer cards, findings, the monthly report).
export const ENGINE_LABELS: Record<Engine, string> = {
  openai: "ChatGPT",
  anthropic: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
};
export type PromptKind = "category" | "branded" | "informational";
export type Position = "first" | "top3" | "mentioned" | "absent";
export type Severity = "critical" | "major" | "minor";
export type FindingStatus = "open" | "fixed" | "verified" | "dismissed";
export interface EngineAnswer { answer: string; citations: string[] }
export interface CheckResult {
  engine: Engine; promptId: string; promptKind: PromptKind;
  answer: string; citations: string[];
  mentioned: boolean; position: Position; competitorsMentioned: string[];
}
