import { readOverview, summarizeOverviews, type OverviewResult, type OverviewSummary } from "@/core/ai-overview";
import { fetchAiOverview } from "@/engines/google-overview";
import { hasDataForSeo } from "@/engines/dataforseo";

/**
 * Searches Google once for each buyer question and reads the AI Overview it
 * shows, if any. One search per question, not one per run: whether Google
 * shows an overview changes far less between identical searches than what a
 * chat assistant says. A search that fails gets one more try, since Google
 * errors and half-loaded overviews usually clear; one that fails twice is
 * counted and skipped, never read as "no overview".
 */
export async function checkAiOverviews(args: {
  questions: string[];
  practiceNames: string[];
  competitorNames: string[];
  fetch?: typeof fetchAiOverview;
}): Promise<OverviewSummary> {
  const fetch = args.fetch ?? fetchAiOverview;
  const read = await Promise.all(args.questions.map(async (question): Promise<OverviewResult | null> => {
    try {
      const overview = await fetch(question).catch(() => fetch(question));
      return readOverview(question, overview, args.practiceNames, args.competitorNames);
    } catch {
      return null;
    }
  }));
  const results = read.filter((r): r is OverviewResult => r !== null);
  return summarizeOverviews(results, read.length - results.length);
}

/** The check a real scan runs: this one when DataForSEO is set up, none otherwise. */
export function aiOverviewCheck(): typeof checkAiOverviews | undefined {
  return hasDataForSeo() ? checkAiOverviews : undefined;
}
