/**
 * The forecast: a rough estimate of how many more leads and customers a
 * business would get if AI named it as often as it names the competitor it
 * names most.
 *
 * It is a chain of multiplications, each one uncertain:
 *
 *   searches for what the business sells, in its area   (bought)
 *   x AI answers per search                             (published ratio)
 *   x the gap in how often AI names it vs the competitor (measured by scans)
 *   x extra visits per extra mention                     (one study)
 *   x visits that become leads, leads that become customers (theirs, or a default)
 *
 * Every uncertain step is a low / likely / high range. The ranges are
 * combined by simulation, never by multiplying the lows together and the
 * highs together: all five steps landing at their low end at once is far
 * rarer than any one of them doing so, and that shortcut would give a range
 * many times too wide. The likely figure is every step at its likely value;
 * the range is the middle 80% of the simulated outcomes.
 *
 * The sources behind each default are in reports/AI visibility lead forecast
 * model.md. A default without a source there does not belong here.
 */

export const FORECAST_MODEL_VERSION = "2026-10";
/** When the published ratios and benchmarks below were last read. */
export const BENCHMARKS_AS_OF = "October 2026";

export interface Range { low: number; likely: number; high: number }

/** Where a number came from, in the words the page uses. */
export type Origin = "measured" | "bought" | "yours" | "prices" | "assumption";
export const ORIGIN_LABEL: Record<Origin, string> = {
  measured: "Measured by Mirror",
  bought: "Bought data",
  yours: "Your number",
  prices: "From your prices",
  assumption: "Industry assumption",
};

export interface Source { name: string; url: string }

const AHREFS_RATIOS: Source = {
  name: "Ahrefs, AI-adjusted volume (September 2026)",
  url: "https://help.ahrefs.com/en/articles/16755865-what-is-ai-adjusted-volume-and-how-is-it-calculated",
};
const PROFOUND_LIFT: Source = { name: "Profound, The AI mention effect (July 2026)", url: "https://www.tryprofound.com/blog/the-ai-mention-effect" };
const LOCALIQ: Source = { name: "LocaliQ search advertising benchmarks (2026)", url: "https://localiq.com/blog/search-advertising-benchmarks/" };
const FIRST_PAGE_SAGE: Source = { name: "First Page Sage conversion rates by industry", url: "https://firstpagesage.com/reports/b2b-conversion-rates-by-industry-fc/" };
const FIRST_PAGE_SAGE_FREEMIUM: Source = { name: "First Page Sage freemium conversion rates (September 2026)", url: "https://firstpagesage.com/seo-blog/saas-freemium-conversion-rates/" };
const INVOCA: Source = { name: "Invoca lead conversion benchmarks", url: "https://www.invoca.com/blog/lead-conversion-rate-benchmarks" };

/**
 * AI answers per Google search on the same topic, for the chat assistants
 * together (ChatGPT, Gemini, Perplexity, Claude, Grok). Ahrefs' published
 * ratios add up to about 0.14; the low and high follow its own bounds for
 * ChatGPT (4% of Google's volume counting only search-like prompts, 18%
 * counting every prompt).
 */
export const ASSISTANT_ANSWERS_PER_SEARCH: Range = { low: 0.05, likely: 0.14, high: 0.22 };
/** The same for Google's AI Mode, which Ahrefs gives as a range with no middle. */
export const AI_MODE_ANSWERS_PER_SEARCH: Range = { low: 0.05, likely: 0.075, high: 0.1 };

/**
 * Each assistant's part of that total, used to weight the mention rate so a
 * tool few people use cannot move the forecast as much as ChatGPT. Claude is
 * not in Ahrefs' table; its weight is our assumption.
 */
export const ASSISTANT_WEIGHT: Record<string, number> = {
  openai: 0.115, gemini: 0.011, perplexity: 0.01, anthropic: 0.005, grok: 0.000054,
};

/**
 * Extra visits within a week for each extra answer that names the business.
 * Profound measured +2.07 to +3.21 points for national brands; the low end is
 * set below that study because a small local business has less name recall.
 */
export const VISITS_PER_MENTION: Range = { low: 0.005, likely: 0.02, high: 0.04 };

export type BusinessType = "home_services" | "clinic" | "legal" | "b2b_software" | "freemium" | "ecommerce" | "other";
export const BUSINESS_TYPES: BusinessType[] = ["home_services", "clinic", "legal", "b2b_software", "freemium", "ecommerce", "other"];
export const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  home_services: "Home and local services",
  clinic: "Clinic, dental or med spa",
  legal: "Legal and professional services",
  b2b_software: "Software sold to businesses",
  freemium: "App or software with a free plan",
  ecommerce: "Online store",
  other: "Something else",
};

interface RateDefault { range: Range; sources: Source[] }
/**
 * Default conversion rates by kind of business, built from the sources named.
 * "Something else" has none: without a benchmark the business's own rates are
 * the only honest input, so the forecast waits for them.
 */
export const RATE_DEFAULTS: Record<Exclude<BusinessType, "other">, { visitToLead: RateDefault; leadToCustomer: RateDefault }> = {
  home_services: {
    visitToLead: { range: { low: 0.02, likely: 0.04, high: 0.08 }, sources: [FIRST_PAGE_SAGE, LOCALIQ] },
    leadToCustomer: { range: { low: 0.08, likely: 0.25, high: 0.45 }, sources: [INVOCA] },
  },
  clinic: {
    visitToLead: { range: { low: 0.02, likely: 0.05, high: 0.1 }, sources: [LOCALIQ] },
    leadToCustomer: { range: { low: 0.15, likely: 0.3, high: 0.45 }, sources: [INVOCA] },
  },
  legal: {
    visitToLead: { range: { low: 0.02, likely: 0.05, high: 0.075 }, sources: [FIRST_PAGE_SAGE, LOCALIQ] },
    leadToCustomer: { range: { low: 0.07, likely: 0.14, high: 0.22 }, sources: [FIRST_PAGE_SAGE] },
  },
  b2b_software: {
    visitToLead: { range: { low: 0.007, likely: 0.011, high: 0.025 }, sources: [FIRST_PAGE_SAGE] },
    leadToCustomer: { range: { low: 0.07, likely: 0.14, high: 0.22 }, sources: [FIRST_PAGE_SAGE] },
  },
  // A free sign-up is the lead; upgrading to a paid plan makes the customer.
  freemium: {
    visitToLead: { range: { low: 0.08, likely: 0.13, high: 0.15 }, sources: [FIRST_PAGE_SAGE_FREEMIUM] },
    leadToCustomer: { range: { low: 0.02, likely: 0.03, high: 0.056 }, sources: [FIRST_PAGE_SAGE_FREEMIUM] },
  },
  // An order is the customer, so the second step is 1.
  ecommerce: {
    visitToLead: { range: { low: 0.01, likely: 0.025, high: 0.05 }, sources: [{ name: "Speed Commerce store benchmarks", url: "https://www.speedcommerce.com/insights/ecommerce-benchmarks-conversion-rates-by-industry-over-by-year/" }] },
    leadToCustomer: { range: { low: 1, likely: 1, high: 1 }, sources: [] },
  },
};

/** What a "lead" is for this kind of business: an order for a store, a free sign-up for software with a free plan. */
export function leadNoun(type: BusinessType): string {
  return type === "ecommerce" ? "order" : type === "freemium" ? "sign-up" : "lead";
}

/** A rate the owner typed is still uncertain for visitors sent by AI, so it gets a range too, narrower than a default. */
export function ownRange(rate: number): Range {
  return { low: rate * 0.6, likely: rate, high: Math.min(1, rate * 1.5) };
}

// ---------------------------------------------------------------------------
// Mention rates
// ---------------------------------------------------------------------------

export interface ForecastCheck {
  engine: string;
  promptKind: string;
  mentioned: boolean;
  competitorsMentioned: string[] | null;
}

export interface MentionRates {
  /** The competitor AI names most. Null when no answer named a competitor. */
  competitor: string | null;
  /** Answers counted (branded questions are left out, as everywhere). */
  answers: number;
  /** How often the chat assistants name each, weighted by how much each assistant is used. Null when none was scanned. */
  assistants: { yours: number; theirs: number } | null;
  /** The same in Google's AI Mode. Null when it was not scanned. */
  aiMode: { yours: number; theirs: number } | null;
}

/**
 * How often AI names the business and its most-named competitor. The
 * competitor is picked once, across every tool, so the comparison is with one
 * real rival and not with the best of several stitched together.
 */
export function mentionRates(checks: ForecastCheck[]): MentionRates {
  const earned = checks.filter(c => c.promptKind !== "branded");
  const named = (rows: ForecastCheck[], name: string) => rows.filter(c => (c.competitorsMentioned ?? []).includes(name)).length;
  const rate = (n: number, of: number) => (of === 0 ? 0 : n / of);

  const byEngine = new Map<string, ForecastCheck[]>();
  for (const c of earned) byEngine.set(c.engine, [...(byEngine.get(c.engine) ?? []), c]);
  const assistantEngines = [...byEngine.keys()].filter(e => e in ASSISTANT_WEIGHT);
  const totalWeight = assistantEngines.reduce((sum, e) => sum + ASSISTANT_WEIGHT[e], 0);
  const weighted = (pick: (rows: ForecastCheck[]) => number) =>
    assistantEngines.reduce((sum, e) => sum + (ASSISTANT_WEIGHT[e] / totalWeight) * pick(byEngine.get(e)!), 0);
  const google = byEngine.get("google") ?? [];

  // The competitor with the most reach: weighted across the assistants, plus AI Mode.
  const names = [...new Set(earned.flatMap(c => c.competitorsMentioned ?? []))];
  const reach = (name: string) =>
    (assistantEngines.length ? weighted(rows => rate(named(rows, name), rows.length)) * ASSISTANT_ANSWERS_PER_SEARCH.likely : 0)
    + rate(named(google, name), google.length) * AI_MODE_ANSWERS_PER_SEARCH.likely;
  const competitor = names.sort((a, b) => reach(b) - reach(a) || a.localeCompare(b))[0] ?? null;

  const pair = (rows: ForecastCheck[]) => ({
    yours: rate(rows.filter(c => c.mentioned).length, rows.length),
    theirs: competitor ? rate(named(rows, competitor), rows.length) : 0,
  });
  return {
    competitor,
    answers: earned.length,
    assistants: assistantEngines.length === 0 ? null : {
      yours: weighted(rows => pair(rows).yours),
      theirs: weighted(rows => pair(rows).theirs),
    },
    aiMode: google.length === 0 ? null : pair(google),
  };
}

// ---------------------------------------------------------------------------
// The forecast
// ---------------------------------------------------------------------------

export interface DemandKeyword { keyword: string; searches: number | null; cpc: number | null }

export interface ForecastInput {
  keywords: DemandKeyword[];
  rates: MentionRates;
  businessType: BusinessType;
  /**
   * The business's own numbers, as fractions (0.05 for 5%) and dollars. The
   * customer value is what one new customer pays: each month when `billing`
   * is "monthly", otherwise in their first year. `valueFrom` says whether the
   * owner typed it or it was read off the prices on their Fact Sheet.
   */
  own: {
    visitToLead?: number | null; leadToCustomer?: number | null; customerValue?: number | null;
    billing?: Billing | null; valueFrom?: "owner" | "prices" | null;
  };
}

/** How a customer pays: every month (a subscription or membership), or once (a job, a visit, an order). */
export type Billing = "monthly" | "once";

/** Fewer answers than this and the mention rate is too noisy to build on. */
export const MIN_ANSWERS = 12;

export type NotReady =
  | "no_demand"      // no search numbers bought yet
  | "no_scan"        // too few answers to measure a mention rate
  | "no_competitor"  // AI named no competitor, so there is no one to catch up with
  | "need_rates";    // no benchmark for this kind of business and no rates from the owner

export interface StepRow {
  label: string;
  /** The value as the page prints it: one number, or low / likely / high. */
  value: string;
  origin: Origin;
  note: string;
  sources: Source[];
}

export interface Estimate { low: number; likely: number; high: number }

export interface Forecast {
  competitor: string;
  /** True when AI already names the business at least as often as the competitor on every tool scanned. */
  ahead: boolean;
  monthlySearches: number;
  /** Extra per year, if AI named the business as often as the competitor. */
  visits: Estimate;
  leads: Estimate;
  customers: Estimate;
  /** Customers x what a customer is worth in their first year. Null without a value, and for subscriptions (see growthPath). */
  revenue: Estimate | null;
  /** What the extra visits would cost to buy as Google ads, from the local price per click. Null without prices. */
  adCost: Estimate | null;
  /** AI visits per month the same sums imply the business gets today, to hold against its analytics. */
  visitsTodayPerMonth: Estimate;
  steps: StepRow[];
  /** The uncertain inputs, widest first: what moves the number most. */
  movers: { label: string; times: number }[];
}

export type ForecastResult = { ready: false; reason: NotReady } | { ready: true; forecast: Forecast };

const DRAWS = 10_000;
/** 80% of a normal curve lies within this many standard deviations of the middle. */
const Z80 = 1.2816;

/** A small seeded generator, so the same inputs always print the same forecast. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One draw from a range. The likely value is the middle outcome, and the low
 * and high are the 10th and 90th percentiles, each side stretched on its own
 * so a lopsided range stays lopsided. Rates never pass 100%.
 */
function draw(range: Range, z: number, cap = Infinity): number {
  if (range.low === range.high) return range.likely;
  const spread = z < 0 ? Math.log(range.likely / range.low) : Math.log(range.high / range.likely);
  return Math.min(cap, range.likely * Math.exp((z * spread) / Z80));
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

const pct = (n: number) => `${+(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
const rangeText = (r: Range, show: (n: number) => string) =>
  r.low === r.high ? show(r.likely) : `${show(r.low)} / ${show(r.likely)} / ${show(r.high)}`;

export function buildForecast(input: ForecastInput): ForecastResult {
  const priced = input.keywords.filter(k => (k.searches ?? 0) > 0);
  const monthlySearches = priced.reduce((sum, k) => sum + (k.searches ?? 0), 0);
  if (monthlySearches === 0) return { ready: false, reason: "no_demand" };
  const { rates } = input;
  if (rates.answers < MIN_ANSWERS || (!rates.assistants && !rates.aiMode)) return { ready: false, reason: "no_scan" };
  if (!rates.competitor) return { ready: false, reason: "no_competitor" };

  const defaults = input.businessType === "other" ? null : RATE_DEFAULTS[input.businessType];
  const ownLead = input.own.visitToLead ?? null;
  const ownClose = input.own.leadToCustomer ?? null;
  if (!defaults && (ownLead === null || ownClose === null)) return { ready: false, reason: "need_rates" };
  const visitToLead = ownLead !== null ? ownRange(ownLead) : defaults!.visitToLead.range;
  const leadToCustomer = ownClose !== null ? ownRange(ownClose) : defaults!.leadToCustomer.range;

  const gap = (pair: { yours: number; theirs: number } | null) => (pair ? Math.max(0, pair.theirs - pair.yours) : 0);
  const assistantGap = gap(rates.assistants);
  const aiModeGap = gap(rates.aiMode);

  // Click price averaged by how often each term is searched.
  const withPrice = priced.filter(k => k.cpc !== null);
  const pricedSearches = withPrice.reduce((sum, k) => sum + (k.searches ?? 0), 0);
  const cpc = pricedSearches === 0 ? null : withPrice.reduce((sum, k) => sum + (k.searches ?? 0) * (k.cpc ?? 0), 0) / pricedSearches;

  const random = seeded(20261013);
  const normal = () => {
    // Box-Muller: two flat draws make one bell-curve draw.
    const u = Math.max(random(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
  };
  /** One pass through the sums, with `z` deciding where inside its range each uncertain step lands. */
  const pass = (z: () => number) => {
    const assistantAnswers = rates.assistants ? monthlySearches * draw(ASSISTANT_ANSWERS_PER_SEARCH, z()) : 0;
    const aiModeAnswers = rates.aiMode ? monthlySearches * draw(AI_MODE_ANSWERS_PER_SEARCH, z()) : 0;
    const lift = draw(VISITS_PER_MENTION, z(), 1);
    const toLead = draw(visitToLead, z(), 1);
    const toCustomer = draw(leadToCustomer, z(), 1);
    const visits = (assistantAnswers * assistantGap + aiModeAnswers * aiModeGap) * lift * 12;
    return {
      visits, leads: visits * toLead, customers: visits * toLead * toCustomer,
      today: (assistantAnswers * (rates.assistants?.yours ?? 0) + aiModeAnswers * (rates.aiMode?.yours ?? 0)) * lift,
    };
  };
  // The likely figure is every step at its likely value, so the working on
  // the page multiplies out to the number shown. The range is the middle 80%
  // of the simulated outcomes.
  const likely = pass(() => 0);
  const runs = Array.from({ length: DRAWS }, () => pass(normal));
  const spread = (key: keyof typeof likely): Estimate => {
    const sorted = runs.map(r => r[key]).sort((a, b) => a - b);
    return { low: Math.min(percentile(sorted, 0.1), likely[key]), likely: likely[key], high: Math.max(percentile(sorted, 0.9), likely[key]) };
  };

  const value = input.own.customerValue ?? null;
  const monthly = input.own.billing === "monthly";
  const customerEstimate = spread("customers");
  const visitEstimate = spread("visits");
  const scale = (e: Estimate, by: number): Estimate => ({ low: e.low * by, likely: e.likely * by, high: e.high * by });

  const steps: StepRow[] = [
    {
      label: "Searches a month for what you sell, in your area",
      value: monthlySearches.toLocaleString("en-US"),
      origin: "bought",
      note: `Google's own count for ${priced.length} search term${priced.length === 1 ? "" : "s"}, bought from DataForSEO. No one publishes how many people ask AI in one city, so this is the starting point.`,
      sources: [{ name: "DataForSEO, Google Ads search volume", url: "https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/live/" }],
    },
    ...(rates.assistants ? [{
      label: "AI assistant answers for each search",
      value: rangeText(ASSISTANT_ANSWERS_PER_SEARCH, n => n.toFixed(2)),
      origin: "assumption" as const,
      note: "For every 100 Google searches on a topic, people put about 14 questions to ChatGPT, Gemini, Perplexity, Claude and Grok. This is a worldwide figure for every topic; none exists for one trade or one city.",
      sources: [AHREFS_RATIOS],
    }, {
      label: `Gap in AI assistants: ${rates.competitor} named in ${pct(rates.assistants.theirs)} of answers, you in ${pct(rates.assistants.yours)}`,
      value: `${Math.round(assistantGap * 100)} points`,
      origin: "measured" as const,
      note: "From your latest scan, leaving out questions that name you. Each assistant counts by how much it is used, so ChatGPT weighs most.",
      sources: [],
    }] : []),
    ...(rates.aiMode ? [{
      label: "Google AI Mode answers for each search",
      value: rangeText(AI_MODE_ANSWERS_PER_SEARCH, n => n.toFixed(2)),
      origin: "assumption" as const,
      note: "Published as a range of 5 to 10 for every 100 Google searches.",
      sources: [AHREFS_RATIOS],
    }, {
      label: `Gap in Google AI Mode: ${rates.competitor} named in ${pct(rates.aiMode.theirs)} of answers, you in ${pct(rates.aiMode.yours)}`,
      value: `${Math.round(aiModeGap * 100)} points`,
      origin: "measured" as const,
      note: "From your latest scan, leaving out questions that name you.",
      sources: [],
    }] : []),
    {
      label: "Extra visits for every 100 extra answers that name you",
      value: rangeText(VISITS_PER_MENTION, n => `${+(n * 100).toFixed(1)}`),
      origin: "assumption",
      note: "One study followed 2 million AI conversations and found 2 to 3 more visits per 100 people who saw a brand named. It covered national brands, so the low end here is set below it for a smaller business.",
      sources: [PROFOUND_LIFT],
    },
    {
      label: input.businessType === "ecommerce" ? "Visits that become an order" : input.businessType === "freemium" ? "Visits that become a free sign-up" : "Visits that become a lead",
      value: rangeText(visitToLead, pct),
      origin: ownLead !== null ? "yours" : "assumption",
      note: ownLead !== null
        ? "Your own rate. Visitors sent by AI may behave a little differently, so it still carries a range."
        : `A typical range for ${BUSINESS_TYPE_LABEL[input.businessType].toLowerCase()}. Your own rate is better: add it on the Forecast page.`,
      sources: ownLead !== null ? [] : defaults!.visitToLead.sources,
    },
    ...(input.businessType === "ecommerce" && ownClose === null ? [] : [{
      label: input.businessType === "freemium" ? "Sign-ups that become paying customers" : "Leads that become a customer",
      value: rangeText(leadToCustomer, pct),
      origin: ownClose !== null ? "yours" as const : "assumption" as const,
      note: ownClose !== null
        ? "Your own rate."
        : "A typical range, and the weakest benchmark here. Your own rate is better: add it on the Forecast page.",
      sources: ownClose !== null ? [] : defaults!.leadToCustomer.sources,
    }]),
    ...(value !== null ? [{
      label: monthly ? "What a new customer pays each month" : "What a new customer is worth in their first year",
      value: `$${Math.round(value).toLocaleString("en-US")}`,
      origin: input.own.valueFrom === "prices" ? "prices" as const : "yours" as const,
      note: input.own.valueFrom === "prices"
        ? "Read from the prices on your Fact Sheet. Correct it on the Forecast page if a typical customer pays something else."
        : "Your number. No reliable benchmark exists for this, so revenue is only shown when there is one.",
      sources: [],
    }] : []),
  ];

  const uncertain: [string, Range][] = [
    ...(rates.assistants && assistantGap > 0 ? [["How many people ask AI assistants", ASSISTANT_ANSWERS_PER_SEARCH] as [string, Range]] : []),
    ...(rates.aiMode && aiModeGap > 0 ? [["How many people use Google AI Mode", AI_MODE_ANSWERS_PER_SEARCH] as [string, Range]] : []),
    ["How many people visit after AI names you", VISITS_PER_MENTION],
    [input.businessType === "ecommerce" ? "How many visits become an order" : "How many visits become a lead", visitToLead],
    ["How many leads become a customer", leadToCustomer],
  ];
  const movers = uncertain
    .filter(([, r]) => r.high > r.low)
    .map(([label, r]) => ({ label, times: +(r.high / r.low).toFixed(1) }))
    .sort((a, b) => b.times - a.times);

  return {
    ready: true,
    forecast: {
      competitor: rates.competitor,
      ahead: assistantGap === 0 && aiModeGap === 0,
      monthlySearches,
      visits: visitEstimate,
      leads: spread("leads"),
      customers: customerEstimate,
      revenue: value === null || monthly ? null : scale(customerEstimate, value),
      adCost: cpc === null ? null : scale(visitEstimate, cpc),
      visitsTodayPerMonth: spread("today"),
      steps,
      movers,
    },
  };
}

// ---------------------------------------------------------------------------
// Growth over the year
// ---------------------------------------------------------------------------

/**
 * How long closing the gap is assumed to take. Nobody has measured this: it
 * is the pace the forecast is drawn at, stated on the page, not a finding.
 */
export const PACE_MONTHS = 12;

/**
 * Share of subscribers who cancel each month, for turning new customers into
 * monthly revenue: 6.1% for business software under $25 a month and 2.2%
 * over $500 (ChartMogul), about 10% for consumer apps (RevenueCat: 28% of
 * yearly subscribers are left after a year).
 */
export const MONTHLY_CHURN: Range = { low: 0.03, likely: 0.06, high: 0.1 };
export const CHURN_SOURCES: Source[] = [
  { name: "ChartMogul, customer churn by price (2022)", url: "https://chartmogul.com/blog/good-customer-churn-rate/" },
  { name: "RevenueCat, State of Subscription Apps 2026", url: "https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026" },
];
/** What is published about how fast this kind of work shows. Agency and vendor claims, not measurements of a gap closing. */
export const PACE_SOURCES: Source[] = [
  { name: "MarGen, GEO results timeline (agency claim, April 2026)", url: "https://www.margen.net/geo-results-timeline-when-will-you-see-ai-citations/" },
  { name: "Profound, AI search volatility (July 2025)", url: "https://tryprofound.com/blog/ai-search-volatility" },
];

export interface GrowthPoint {
  month: number;
  /** Running totals since today. */
  visits: Estimate;
  leads: Estimate;
  customers: Estimate;
  /** Subscriptions: revenue a month from the customers gained and still paying. Otherwise: running total of first-year value. Null without a customer value. */
  revenue: Estimate | null;
}

/**
 * The year ahead, month by month, if the gap to the competitor closes at a
 * steady pace over PACE_MONTHS. In month m the business gets m/12 of the
 * extra visits it would get with the gap fully closed, so the running totals
 * curve upward and reach just over half a full year's worth by month 12.
 */
export function growthPath(
  forecast: Pick<Forecast, "visits" | "leads" | "customers">,
  own: { customerValue?: number | null; billing?: Billing | null },
): GrowthPoint[] {
  const value = own.customerValue ?? null;
  const share = (m: number) => Math.min(1, m / PACE_MONTHS);
  // Running total after `m` months of a yearly rate that is reached gradually.
  const total = (perYear: number, m: number) => (perYear / 12) * Array.from({ length: m }, (_, k) => share(k + 1)).reduce((a, b) => a + b, 0);
  const totals = (e: Estimate, m: number): Estimate => ({ low: total(e.low, m), likely: total(e.likely, m), high: total(e.high, m) });
  // Monthly revenue from subscribers gained in months 1..m, less those who have cancelled since.
  const recurring = (customersPerYear: number, m: number, churn: number) => Array.from({ length: m }, (_, k) =>
    (customersPerYear / 12) * share(k + 1) * value! * (1 - churn) ** (m - (k + 1))).reduce((a, b) => a + b, 0);
  return Array.from({ length: PACE_MONTHS + 1 }, (_, month) => {
    const customers = totals(forecast.customers, month);
    return {
      month,
      visits: totals(forecast.visits, month),
      leads: totals(forecast.leads, month),
      customers,
      revenue: value === null ? null : own.billing === "monthly" ? {
        low: recurring(forecast.customers.low, month, MONTHLY_CHURN.high),
        likely: recurring(forecast.customers.likely, month, MONTHLY_CHURN.likely),
        high: recurring(forecast.customers.high, month, MONTHLY_CHURN.low),
      } : { low: customers.low * value, likely: customers.likely * value, high: customers.high * value },
    };
  });
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** A count of leads or customers as a whole number. Anything that rounds to none is "fewer than 1". */
export function wholeNumber(n: number): string {
  return n < 0.5 ? "fewer than 1" : Math.round(n).toLocaleString("en-US");
}

/** "1 to 16", "fewer than 1", or "up to 4" when the low end rounds to none. */
export function rangeWords(e: Estimate): string {
  if (e.high < 0.5) return "fewer than 1";
  if (e.low < 0.5) return `up to ${wholeNumber(e.high)}`;
  const low = wholeNumber(e.low), high = wholeNumber(e.high);
  return low === high ? low : `${low} to ${high}`;
}

/** Dollars rounded hard: to the ten under $1,000, to the hundred under $10,000, to the thousand above. */
export function roughDollars(n: number): string {
  const step = n < 1000 ? 10 : n < 10_000 ? 100 : 1000;
  return `$${(Math.round(n / step) * step).toLocaleString("en-US")}`;
}
