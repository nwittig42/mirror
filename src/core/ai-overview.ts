import { findMatches, mentionKind } from "@/core/mention";

/**
 * What Google's AI Overview said for one buyer question. An overview is the
 * AI box above Google's ordinary results; Google shows one for some searches
 * and not for others, so "not shown" is its own outcome, different from
 * "shown, and you weren't in it".
 */
export interface OverviewResult {
  question: string;
  shown: boolean;
  /** The business is really named in the overview (an echo of the question does not count). */
  named: boolean;
  /** Known competitors the overview names, in the order they appear. */
  competitors: string[];
  citations: string[];
  answer: string;
}

export interface OverviewSummary {
  /** Questions searched and read successfully. */
  asked: number;
  /** Of those, how many Google answered with an AI Overview. */
  shown: number;
  /** Of the overviews shown, how many name the business. */
  namedIn: number;
  /** Searches that failed and are left out of every count above. */
  failed: number;
  results: OverviewResult[];
}

/** Reads one overview with the same name matching a scan uses for every other answer. */
export function readOverview(
  question: string,
  overview: { shown: boolean; answer: string; citations: string[] },
  practiceNames: string[],
  competitorNames: string[],
): OverviewResult {
  if (!overview.shown) return { question, shown: false, named: false, competitors: [], citations: [], answer: "" };
  return {
    question,
    shown: true,
    named: mentionKind(overview.answer, practiceNames, competitorNames) === "named",
    competitors: findMatches(overview.answer, competitorNames, practiceNames).map(m => m.name),
    citations: overview.citations,
    answer: overview.answer,
  };
}

export function summarizeOverviews(results: OverviewResult[], failed = 0): OverviewSummary {
  const shown = results.filter(r => r.shown);
  return { asked: results.length, shown: shown.length, namedIn: shown.filter(r => r.named).length, failed, results };
}
