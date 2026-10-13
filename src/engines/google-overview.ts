import { EngineError } from "@/engines/types";
import { answerText, citationsOf, searchGoogle } from "@/engines/dataforseo";

/**
 * Google AI Overviews: the AI box Google puts above its ordinary results for
 * some searches. Unlike the engines a scan asks, it does not always answer,
 * and "Google showed no overview" is a finding in itself, so it is not an
 * EngineAdapter and never counts toward the score or coverage.
 */
export interface AiOverview {
  /** Whether Google showed an AI Overview for this search. */
  shown: boolean;
  /** The overview's text, empty when none was shown. */
  answer: string;
  citations: string[];
}

/** Searches Google for `question` and reads the AI Overview, if it shows one. */
export async function fetchAiOverview(question: string): Promise<AiOverview> {
  // Google often fills the box in after the page loads; without this only
  // overviews it happened to have cached come back. Refunded when none loads.
  const items = await searchGoogle("google", "organic", question, { load_async_ai_overview: true });
  const overview = items.find(item => item.type === "ai_overview");
  if (!overview) return { shown: false, answer: "", citations: [] };
  const answer = answerText(overview);
  // The box is on the page but its text never arrived. Google did show an
  // overview, so this is a read that failed, not "no overview".
  if (!answer) throw new EngineError("google", 502, "AI Overview shown but not loaded");
  return { shown: true, answer, citations: citationsOf(overview) };
}
