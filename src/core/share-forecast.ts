import { buyerCompetitors } from "@/core/competitors";
import { FOLLOW_THROUGH, type Range } from "@/core/forecast";

export interface ShareCheck { promptKind: string; mentioned: boolean; competitorsMentioned: string[] | null }

export interface ShareForecast {
  /** Buyer answers counted. */
  answers: number;
  /** Share of buyer answers that name the business today, 0 to 100. */
  now: number;
  /** The same once the Next steps have won back FOLLOW_THROUGH of the answers lost to a competitor. */
  then: Range;
  /** Competitors by share today, most named first. Assumed to stay where they are. */
  competitors: { name: string; share: number }[];
  /** The business's place among everyone AI named, 1-based, today and with the Next steps done. */
  rankNow: number;
  rankThen: number;
}

/**
 * How often AI recommends the business, as a share of the buyer answers in
 * its scan, today and once its Next steps have worked: the number the
 * forecast leads with, because it is measured, not estimated. The future
 * share adds FOLLOW_THROUGH's share of the answers that named a competitor
 * and not the business; competitors are held where they are. Null with no
 * buyer answers.
 */
export function shareForecast(checks: ShareCheck[]): ShareForecast | null {
  const earned = checks.filter(c => c.promptKind !== "branded");
  if (earned.length === 0) return null;
  const pct = (n: number) => Math.round((n / earned.length) * 100);
  const named = earned.filter(c => c.mentioned).length;
  const lost = earned.filter(c => !c.mentioned && (c.competitorsMentioned?.length ?? 0) > 0).length;
  const at = (share: number) => pct(named + lost * share);
  const competitors = buyerCompetitors(earned).map(c => ({ name: c.name, share: pct(c.mentions) }));
  const rank = (share: number) => 1 + competitors.filter(c => c.share > share).length;
  const then = { low: at(FOLLOW_THROUGH.low), likely: at(FOLLOW_THROUGH.likely), high: at(FOLLOW_THROUGH.high) };
  return { answers: earned.length, now: pct(named), then, competitors, rankNow: rank(pct(named)), rankThen: rank(then.likely) };
}

/** "more than twice as often", "about 50% more often": the change in words, never a bare percentage. */
export function changeWords(now: number, then: number): string | null {
  if (now <= 0 || then <= now) return null;
  const times = then / now;
  if (times >= 3) return `about ${Math.floor(times)} times as often`;
  if (times >= 2) return "more than twice as often";
  if (times >= 1.45) return "about half again as often";
  return `about ${Math.round((times - 1) * 100)}% more often`;
}
