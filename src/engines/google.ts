import type { EngineAdapter } from "@/engines/types";
import { EngineError } from "@/engines/types";
import { answerText, citationsOf, searchGoogle } from "@/engines/dataforseo";

/**
 * Google AI Mode: the full AI answer Google gives when a person asks it a
 * question. Asked like any other engine, once per question per run.
 */
export const googleAdapter: EngineAdapter = {
  name: "google",
  async run(prompt) {
    const overview = (await searchGoogle("google", "ai_mode", prompt)).find(item => item.type === "ai_overview");
    const answer = overview ? answerText(overview) : "";
    // No answer is not "they didn't name you": it is an answer we don't
    // have, so it counts against coverage like any other failed call.
    if (!overview || !answer) throw new EngineError("google", 502, "no AI Mode answer");
    return { answer, citations: citationsOf(overview) };
  },
};
