import { classifyDomain, domainOf } from "@/core/citations";
import { FACT_PENALTY, PRICE_MULTIPLIER, computeFactScore } from "@/core/scoring";
import type { Severity } from "@/core/types";
import type { Range, Source } from "@/core/forecast";

/**
 * Where the Accuracy score could go as wrong facts are fixed.
 *
 * The score itself is exact arithmetic: every wrong fact in the latest scan
 * costs a known number of points, so fixing one gives those points back. The
 * uncertain part is time: how long after a source is corrected AI stops
 * repeating the mistake. That depends on where AI read it, so each wrong fact
 * is sorted by its source and given the chance it is gone by 3, 6, 9 and 12
 * months. The forecast is the score with each wrong fact's points returned in
 * proportion to that chance.
 *
 * The chances are estimates (see FIXED_BY). They assume the fix is actually
 * made in week one.
 */

/** Where AI read a wrong fact, which decides how hard and how slow the fix is. */
export type FixSource = "own_site" | "listing" | "elsewhere" | "memory";

export const FIX_SOURCE_LABEL: Record<FixSource, string> = {
  own_site: "Read on your own website",
  listing: "Read on a listing or review site",
  elsewhere: "Read on someone else's page",
  memory: "No source given",
};

export const FIX_SOURCE_NOTE: Record<FixSource, string> = {
  own_site: "You control the page. Once it is corrected, AI tools that search the web can pick it up within days to a few weeks. Answers given from memory change more slowly.",
  listing: "A profile that can be claimed and edited, such as Google, Yelp or a directory. The edit is quick; the site and then the AI tools take longer to refresh.",
  elsewhere: "A page nobody on your side can edit, such as an old article or a forum post. The fix is to ask its owner and to state the right version more clearly on your own site, which works less often.",
  memory: "AI answered from what it learned in training. Stating the right version plainly on your site helps the tools that search; the rest only changes when the AI model itself is updated, which takes months.",
};

export const FORECAST_MONTHS = [3, 6, 9, 12] as const;
export type ForecastMonth = (typeof FORECAST_MONTHS)[number];

/**
 * The chance a wrong fact is gone from AI answers this many months after its
 * fix is made: low / likely / high. Nobody has published a measured rate, so
 * these are our estimates from the nearest evidence, and the range widens
 * the further out they go:
 *  - own site: AI tools that search picked up a changed page in 1 day to 3
 *    weeks in small tests, and ChatGPT followed a brand's own page in 84% of
 *    answers; but only part of all answers use live search, which holds the
 *    first months down. The rest follow as the AI models are retrained.
 *  - listing: data providers push an edit in 1 day to 1 month and the sites
 *    downstream refresh weekly to yearly.
 *  - elsewhere: Perplexity and Gemini kept repeating third-party claims in
 *    37-39% of answers despite an official correction, and a page nobody
 *    corrects keeps feeding both live search and the next model.
 *  - memory: a model's training data ends 4 or more months before release,
 *    so a fix cannot reach it in the first months; only the answers that
 *    search can change. Later in the year a newer model is likely to have
 *    read the corrected page, so the chance rises.
 */
export const FIXED_BY: Record<FixSource, Record<ForecastMonth, Range>> = {
  own_site: { 3: { low: 0.6, likely: 0.75, high: 0.85 }, 6: { low: 0.7, likely: 0.85, high: 0.92 }, 9: { low: 0.72, likely: 0.88, high: 0.95 }, 12: { low: 0.75, likely: 0.9, high: 0.96 } },
  listing: { 3: { low: 0.5, likely: 0.65, high: 0.75 }, 6: { low: 0.6, likely: 0.75, high: 0.85 }, 9: { low: 0.65, likely: 0.8, high: 0.9 }, 12: { low: 0.68, likely: 0.85, high: 0.93 } },
  elsewhere: { 3: { low: 0.1, likely: 0.22, high: 0.35 }, 6: { low: 0.15, likely: 0.3, high: 0.45 }, 9: { low: 0.18, likely: 0.35, high: 0.52 }, 12: { low: 0.2, likely: 0.4, high: 0.6 } },
  memory: { 3: { low: 0.05, likely: 0.15, high: 0.25 }, 6: { low: 0.12, likely: 0.3, high: 0.5 }, 9: { low: 0.2, likely: 0.45, high: 0.65 }, 12: { low: 0.25, likely: 0.55, high: 0.75 } },
};

/** The evidence the chances above lean on. */
export const FIX_SOURCES: Source[] = [
  { name: "Ahrefs, AI and a made-up brand (December 2025)", url: "https://ahrefs.com/blog/ai-vs-made-up-brand-experiment/" },
  { name: "Full Fact, AI chatbots and misinformation (August 2026)", url: "https://fullfact.org/technology/full-fact-analysis--ai-chatbots-misinformation/" },
  { name: "BrightLocal, how long listing updates take", url: "https://help.brightlocal.com/hc/en-us/articles/360036410794" },
  { name: "Insites, AI accuracy on 10,000 local businesses (July 2026)", url: "https://insites.com/blog/does-chatgpt-hallucinate-local-businesses-the-data-on-ai-accuracy/" },
];

/** Sorts a wrong fact by the pages the AI tool cited when it stated it. */
export function fixSource(citations: string[], website: string | null): FixSource {
  const ownDomain = domainOf(website?.includes("://") ? website : `https://${website ?? ""}`);
  const kinds = citations.map(domainOf).filter((d): d is string => !!d).map(d => classifyDomain(d, ownDomain));
  if (kinds.includes("own_site")) return "own_site";
  if (kinds.includes("reviews") || kinds.includes("google")) return "listing";
  return kinds.length ? "elsewhere" : "memory";
}

export interface WrongFact {
  label: string;
  severity: Severity;
  /** The fact's category on the Fact Sheet; a price costs more. */
  category: string | null;
  source: FixSource;
}

/** Points one wrong fact costs the Accuracy score. */
export function pointsFor(f: { severity: Severity; category: string | null }): number {
  return FACT_PENALTY[f.severity] * (f.category === "pricing" ? PRICE_MULTIPLIER : 1);
}

/**
 * Whether a serious wrong fact is still expected to be around at a given
 * month. One caps the Overall score, so the cap is counted as lifted once
 * every serious wrong fact is at least as likely gone as not.
 */
export function seriousLeft(facts: WrongFact[], month: number, end: keyof Range): boolean {
  return facts.some(f => f.severity === "critical" && FIXED_BY[f.source][month as ForecastMonth][end] < 0.5);
}

export interface AccuracyPoint { month: number; low: number; likely: number; high: number }

export interface AccuracyForecast {
  /** Accuracy in the latest scan. */
  now: number;
  /** Accuracy with every wrong fact gone. */
  best: number;
  points: AccuracyPoint[];
  /** Each wrong fact with the points it costs, most costly first. */
  facts: (WrongFact & { points: number })[];
  /** How many wrong facts came from each kind of source, and the points they cost together. */
  bySource: { source: FixSource; count: number; points: number }[];
}

/**
 * The Accuracy forecast from the wrong facts the latest scan found. Null when
 * the scan checked no facts, or found nothing wrong: there is nothing to
 * forecast.
 */
export function forecastAccuracy(args: { judgedChecks: number; wrong: WrongFact[] }): AccuracyForecast | null {
  const now = computeFactScore({ judgedChecks: args.judgedChecks, openFindings: args.wrong });
  if (now === null || args.wrong.length === 0) return null;

  const facts = args.wrong.map(f => ({ ...f, points: pointsFor(f) })).sort((a, b) => b.points - a.points);
  // Points still lost at a given month: each fact's points, less the share of them its fix is expected to have returned.
  const scoreAt = (month: ForecastMonth, end: keyof Range) =>
    Math.max(0, Math.round(100 - facts.reduce((sum, f) => sum + f.points * (1 - FIXED_BY[f.source][month][end]), 0)));
  const points: AccuracyPoint[] = FORECAST_MONTHS.map(month => ({
    month, low: scoreAt(month, "low"), likely: scoreAt(month, "likely"), high: scoreAt(month, "high"),
  }));

  const order: FixSource[] = ["own_site", "listing", "elsewhere", "memory"];
  return {
    now,
    best: 100,
    points,
    facts,
    bySource: order
      .map(source => ({ source, count: facts.filter(f => f.source === source).length, points: facts.filter(f => f.source === source).reduce((s, f) => s + f.points, 0) }))
      .filter(row => row.count > 0),
  };
}
