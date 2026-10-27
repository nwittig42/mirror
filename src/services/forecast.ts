import { and, desc, eq, ne } from "drizzle-orm";
import type { Db } from "@/db";
import { facts, forecastSnapshots, practices, prompts } from "@/db/schema";
import { loadEnv } from "@/lib/env";
import { getChecksForScan, getLatestScan } from "@/lib/queries";
import {
  BUSINESS_TYPES, FORECAST_MODEL_VERSION, buildForecast, mentionRates,
  type Billing, type BusinessType, type DemandKeyword, type ForecastInput, type ForecastResult, type Range,
  type ValueEstimate,
} from "@/core/forecast";

/**
 * What the forecast needs beyond a scan, kept on the business. The operator
 * sets the area and the search terms and buys the search numbers; the owner
 * (or the operator, after the call) adds the business's own rates.
 */
export interface ForecastSetup {
  /** The area searched, in DataForSEO's spelling: "Los Angeles,California,United States", or "United States". */
  area: string | null;
  businessType: BusinessType;
  keywords: DemandKeyword[];
  /** When the search numbers were bought (ISO date). Null until they are. */
  demandAt: string | null;
  /** The owner's own numbers: rates as fractions (0.05 for 5%), value in dollars. */
  visitToLead: number | null;
  leadToCustomer: number | null;
  /** What one new customer pays: each month when `billing` is "monthly", otherwise in their first year. */
  customerValue: number | null;
  billing: Billing;
  /** Who set the customer value: the owner, or the AI reading the prices on the Fact Sheet. Null with no value. */
  valueFrom: "owner" | "prices" | null;
  /** The ranged value drafted from the prices, with its working. Null until drafted, and on setups saved before it existed. */
  valueEstimate: ValueEstimate | null;
}

export const EMPTY_SETUP: ForecastSetup = {
  area: null, businessType: "other", keywords: [], demandAt: null,
  visitToLead: null, leadToCustomer: null, customerValue: null, billing: "once", valueFrom: null, valueEstimate: null,
};

/** An area as people say it: "Los Angeles, California", or "United States" for a business that sells everywhere. */
export function areaWords(area: string): string {
  const parts = area.split(",");
  return (parts.length > 1 ? parts.slice(0, -1) : parts).join(", ");
}

/** An area as typed, in DataForSEO's spelling: no spaces around the commas. Null when blank. */
export function cleanArea(text: string): string | null {
  return text.split(",").map(part => part.trim()).filter(Boolean).join(",").slice(0, 120) || null;
}

export const MAX_KEYWORDS = 40;

/** Search terms as typed, one a line: trimmed, lower-cased, each once, capped. */
export function cleanKeywords(text: string): string[] {
  const seen = new Set<string>();
  for (const line of text.split(/[\n,]+/)) {
    // Google Ads refuses terms over 80 characters or 10 words, and most punctuation.
    const term = line.toLowerCase().replace(/[^a-z0-9&' -]+/g, " ").replace(/\s+/g, " ").trim();
    if (term && term.length <= 80 && term.split(" ").length <= 10) seen.add(term);
  }
  return [...seen].slice(0, MAX_KEYWORDS);
}

const SETUP_SYSTEM = `You set up a sales forecast for a business from what its own website says about it. You decide three things.

1. KIND. One of:
- home_services: trades and local services people call out or visit (plumber, roofer, cleaner, salon, gym, auto repair).
- clinic: medical, dental, cosmetic or wellness practices that book appointments (dentist, med spa, physio, vet).
- legal: law firms and other professional advisers (accountant, financial adviser, consultant, agency).
- b2b_software: software or online tools sold to businesses through demos, trials or a sales team.
- freemium: software or an app with a free plan that people sign up for and then upgrade, whether they are individuals, students or businesses.
- ecommerce: an online store that sells products.
- local_shop: restaurants, cafés, bakeries, coffee shops, dessert shops, bars and shops people walk into to buy.
- other: anything else, including schools. Choose this when unsure.

2. AREA. Where most of its customers come from, in exactly this form: City,State,United States. Use the main city of its metro area, since customers travel in from around it: a clinic in Santa Monica is "Los Angeles,California,United States". A business that sells online or across the country is "United States".

3. SEARCHES. 12 to 20 Google searches a buyer types when they want to hire, book or buy from a business like this. Each 1 to 4 words, lower case, the way people really type. The kind of business, its main services, and "near me" forms. No questions, no "how to", no brand names, no competitor names. Leave the city out: the counts are already taken inside the area. Only what this business sells.

4. VALUE. What one typical new customer is worth, from the prices the website states and the kind of business. Give:
- spend: what a customer spends on one visit or order, low / likely / high in dollars. Likely is a typical order. Low and high are what a cheaper and a pricier typical order cost (about the 10th and 90th percentile of customers), not the cheapest or dearest item. Leave out rare large orders, such as wedding cakes, catering or a full renovation.
- visits: how many times a new customer buys in their first year, low / likely / high. 1 for a one-off job. For a local_shop keep within: café, bakery or coffee shop 2 to 12 (likely about 4); restaurant 1 to 6 (likely about 2); shop 1 to 4.
- billing: "monthly" for a subscription or membership, then give the monthly price as spend and 1 / 1 / 1 as visits. Otherwise "once".
- basis: one plain sentence naming the prices used, such as "Most customers book a standard service at $90 to $150; a few add extras that bring it to $200."
- confidence: "high" only when the website states prices for what most customers buy, otherwise "low".
If no prices are stated, give "value": null. Never guess a price.

Answer with JSON only, no other text:
{"kind": "...", "area": "...", "searches": ["...", "..."], "value": {"spend": {"low": 0, "likely": 0, "high": 0}, "visits": {"low": 0, "likely": 0, "high": 0}, "billing": "once", "basis": "...", "confidence": "high"}}`;

export interface SetupDraft {
  businessType: BusinessType; area: string | null; keywords: string[];
  /** What a typical new customer is worth, worked out from the stated prices. Null when the website states none. */
  value: { estimate: ValueEstimate; billing: Billing } | null;
}

/** A low / likely / high the AI gave, or null unless all three are numbers in order, at least `min` and no more than `max`. */
function parseRange(raw: unknown, min: number, max: number): Range | null {
  if (!raw || typeof raw !== "object") return null;
  const { low, likely, high } = raw as Record<string, unknown>;
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= min;
  if (!ok(low) || !ok(likely) || !ok(high) || low > likely || likely > high || high > max) return null;
  return { low, likely, high };
}

/**
 * Visits in a customer's first year, held to what the kind of business can
 * have: a café, restaurant or shop 1 to 12 (likely no more than 6), an online
 * store one order (its value is one order), anything else no more than 12,
 * and a subscription one payment a month. Kept in order low, likely, high.
 */
export function clampVisits(kind: BusinessType, visits: Range, billing: Billing): Range {
  if (billing === "monthly" || kind === "ecommerce") return { low: 1, likely: 1, high: 1 };
  const high = Math.min(Math.max(visits.high, 1), 12);
  const likely = Math.min(Math.max(visits.likely, 1), kind === "local_shop" ? 6 : 12, high);
  const low = Math.min(Math.max(visits.low, 1), likely);
  return { low, likely, high };
}

/** The drafted customer value, or null when any part of it is missing or makes no sense. */
function parseValue(raw: unknown, kind: BusinessType): SetupDraft["value"] {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const spend = parseRange(v.spend, 0.01, 10_000_000);
  // A customer buys at least once.
  const visits = parseRange(v.visits, 1, 365);
  const basis = typeof v.basis === "string" ? v.basis.trim().slice(0, 240) : "";
  if (!spend || !visits || !basis) return null;
  const billing: Billing = v.billing === "monthly" ? "monthly" : "once";
  return {
    estimate: {
      spend,
      // A subscription is one payment a month; its yearly sums are worked out month by month.
      visits: clampVisits(kind, visits, billing),
      basis,
      confidence: v.confidence === "high" ? "high" : "low",
    },
    billing,
  };
}

/** Reads the AI's answer. Anything it got wrong falls back to the cautious choice: "Something else", no area, no searches, no value. */
export function parseSetupDraft(text: string): SetupDraft {
  let raw: { kind?: unknown; area?: unknown; searches?: unknown; value?: unknown } = {};
  try {
    raw = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch { /* not JSON: every field falls back */ }
  const area = typeof raw.area === "string" ? raw.area.split(",").map(part => part.trim()).filter(Boolean).join(",") : "";
  const businessType: BusinessType = (BUSINESS_TYPES as unknown[]).includes(raw.kind) ? (raw.kind as BusinessType) : "other";
  return {
    businessType,
    // DataForSEO names every area "..., United States"; anything else would be refused when the numbers are bought.
    area: /(^|,)United States$/.test(area) && area.length <= 120 ? area : null,
    keywords: cleanKeywords(Array.isArray(raw.searches) ? raw.searches.filter(s => typeof s === "string").join("\n") : ""),
    value: parseValue(raw.value, businessType),
  };
}

/** Asks the AI what kind of business this is, where its customers come from and what they search for. */
export async function suggestSetup(args: {
  name: string; category: string | null; location: string | null; questions: string[]; facts: string[];
}): Promise<SetupDraft> {
  const env = loadEnv();
  const content = [
    `BUSINESS: ${args.name}`,
    args.category ? `DESCRIBED AS: ${args.category}` : "",
    args.location ? `LOCATED IN: ${args.location}` : "",
    args.facts.length ? `WHAT ITS WEBSITE SAYS:\n${args.facts.map(f => `- ${f}`).join("\n")}` : "",
    args.questions.length ? `QUESTIONS ITS BUYERS ASK AI:\n${args.questions.map(q => `- ${q}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: env.ANTHROPIC_MODEL, max_tokens: 1200, system: SETUP_SYSTEM, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) throw new Error(`Could not draft the forecast setup (${res.status}).`);
  const data = await res.json();
  return parseSetupDraft((data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join(""));
}

/**
 * Buys Google's monthly search count and click price for each term inside
 * one area, from DataForSEO's Google Ads data. One request, about 9 cents,
 * whatever the number of terms. Terms Google has no number for come back
 * null: long or unusual phrasings usually do.
 */
export async function fetchSearchVolume(keywords: string[], area: string, fetchImpl: typeof fetch = fetch): Promise<DemandKeyword[]> {
  const env = loadEnv();
  if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) throw new Error("DataForSEO is not set up.");
  const login = Buffer.from(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`).toString("base64");
  const res = await fetchImpl("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live", {
    method: "POST",
    headers: { Authorization: `Basic ${login}`, "Content-Type": "application/json" },
    // Given up after 20 seconds, so a hung request cannot hold up an audit.
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify([{ keywords, location_name: area, language_code: "en" }]),
  });
  const data = await res.json().catch(() => null);
  const task = data?.tasks?.[0];
  const code: number = task?.status_code ?? data?.status_code ?? res.status;
  if (code === 40200 || code === 40210) throw new Error("The DataForSEO account is out of credit. Add credit, then try again.");
  if (code !== 20000) {
    const message: string = task?.status_message ?? data?.status_message ?? "";
    throw new Error(/location/i.test(message)
      ? `DataForSEO does not know the area "${area}". Write it as City,State,United States.`
      : `DataForSEO could not answer (${code} ${message}).`.trim());
  }
  const rows: { keyword: string; search_volume: number | null; cpc: number | null }[] = task.result ?? [];
  const found = new Map(rows.map(r => [r.keyword.toLowerCase(), r]));
  return keywords.map(keyword => ({
    keyword,
    searches: found.get(keyword)?.search_volume ?? null,
    cpc: found.get(keyword)?.cpc ?? null,
  }));
}

/**
 * Buys the search numbers for a business's terms in its area and stores them.
 * Skipped without a request when there is no area or no terms, and when every
 * term already has a number, unless `force` is on (the operator asking again).
 * DataForSEO's errors are thrown as they are, in plain words.
 */
export async function buyDemand(
  db: Db, practiceId: string, fetchImpl: typeof fetch = fetch, opts: { force?: boolean } = {},
): Promise<"bought" | "skipped"> {
  const [practice] = await db.select({ forecast: practices.forecast }).from(practices).where(eq(practices.id, practiceId));
  if (!practice) return "skipped";
  const setup = { ...EMPTY_SETUP, ...(practice.forecast ?? {}) };
  if (!setup.area || setup.keywords.length === 0 || (!opts.force && setup.keywords.every(k => k.searches !== null))) return "skipped";
  const keywords = await fetchSearchVolume(setup.keywords.map(k => k.keyword), setup.area, fetchImpl);
  await db.update(practices).set({ forecast: { ...setup, keywords, demandAt: new Date().toISOString() } }).where(eq(practices.id, practiceId));
  return "bought";
}

/**
 * A new prospect's forecast: drafts the setup, then buys the search numbers
 * (a few cents) so the forecast is ready when the scan finishes, then keeps a
 * snapshot. A failed purchase is logged and the setup carries on; the
 * forecast then says it is not ready.
 */
export async function prepareForecast(db: Db, practiceId: string, deps: {
  draft?: (db: Db, practiceId: string) => Promise<unknown>;
  buy?: (db: Db, practiceId: string) => Promise<unknown>;
  snapshot?: (db: Db, practiceId: string) => Promise<boolean>;
} = {}): Promise<void> {
  await (deps.draft ?? draftForecastSetup)(db, practiceId);
  await (deps.buy ?? buyDemand)(db, practiceId).catch(err =>
    console.error("[prospect] search numbers not bought", practiceId, err instanceof Error ? err.message : err));
  await (deps.snapshot ?? saveForecastSnapshot)(db, practiceId).catch(() => false);
}

/**
 * Drafts the forecast setup from what is already known about the business:
 * its Fact Sheet (drafts included, since this runs straight after the website
 * is read) and its buyer questions. The kind and the area are set where the
 * operator has not chosen them yet, or always when `overwrite` is on;
 * searches are added to any already listed. Search numbers already bought
 * are kept unless the area changes. The operator confirms all of it on the
 * call. Returns false when there was nothing to draft from.
 */
export async function draftForecastSetup(
  db: Db, practiceId: string, opts: { overwrite?: boolean; suggest?: typeof suggestSetup } = {},
): Promise<boolean> {
  const [practice] = await db.select().from(practices).where(eq(practices.id, practiceId));
  if (!practice) return false;
  const [asked, known] = await Promise.all([
    db.select({ text: prompts.text }).from(prompts)
      .where(and(eq(prompts.practiceId, practiceId), eq(prompts.active, true), eq(prompts.kind, "category"))),
    db.select({ label: facts.label, value: facts.value }).from(facts)
      .where(and(eq(facts.practiceId, practiceId), ne(facts.status, "archived"))),
  ]);
  if (asked.length === 0 && known.length === 0 && !practice.category) return false;
  const draft = await (opts.suggest ?? suggestSetup)({
    name: practice.name, category: practice.category, location: practice.location,
    questions: asked.map(p => p.text), facts: known.slice(0, 60).map(f => `${f.label}: ${f.value}`.slice(0, 160)),
  });

  const fresh = practice.forecast === null;
  const setup = { ...EMPTY_SETUP, ...(practice.forecast ?? {}) };
  const area = opts.overwrite || !setup.area ? draft.area ?? setup.area : setup.area;
  const moved = area !== setup.area;
  const have = new Set(setup.keywords.map(k => k.keyword));
  const businessType = opts.overwrite || fresh ? draft.businessType : setup.businessType;
  // The visits are held to the kind the business keeps, which may not be the one the AI guessed.
  const estimate = draft.value && { ...draft.value.estimate, visits: clampVisits(businessType, draft.value.estimate.visits, draft.value.billing) };
  await db.update(practices).set({
    forecast: {
      ...setup,
      area,
      businessType,
      keywords: [
        ...setup.keywords.map(k => (moved ? { keyword: k.keyword, searches: null, cpc: null } : k)),
        ...draft.keywords.filter(k => !have.has(k)).map(keyword => ({ keyword, searches: null, cpc: null })),
      ].slice(0, MAX_KEYWORDS),
      demandAt: moved ? null : setup.demandAt,
      // A value the owner typed is never replaced by one read off the website.
      ...(draft.value !== null && setup.valueFrom !== "owner" && (setup.customerValue === null || setup.valueFrom === "prices")
        ? {
          valueEstimate: estimate!,
          customerValue: Math.round(estimate!.spend.likely * estimate!.visits.likely * 100) / 100,
          billing: draft.value.billing,
          valueFrom: "prices" as const,
        } : {}),
    },
  }).where(eq(practices.id, practiceId));
  return true;
}

/** JSON with every object's keys in order, since the database hands a stored object back with its keys rearranged. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
}

export interface LoadedForecast {
  setup: ForecastSetup;
  input: ForecastInput;
  result: ForecastResult;
  scanId: string | null;
  scanDate: Date | null;
}

/** Builds the forecast for a business from its setup and its latest finished scan. */
export async function loadForecast(
  db: Db, practice: { id: string; forecast: ForecastSetup | null },
): Promise<LoadedForecast> {
  const setup = { ...EMPTY_SETUP, ...(practice.forecast ?? {}) };
  const scan = await getLatestScan(db, practice.id);
  const checks = scan ? await getChecksForScan(db, scan.id) : [];
  const input: ForecastInput = {
    keywords: setup.keywords,
    rates: mentionRates(checks),
    businessType: setup.businessType,
    own: {
      visitToLead: setup.visitToLead, leadToCustomer: setup.leadToCustomer, customerValue: setup.customerValue,
      billing: setup.billing, valueFrom: setup.customerValue === null ? null : setup.valueFrom ?? "owner",
      // Left out when there is none, so a setup saved before estimates existed keeps the same input and is not snapshotted again.
      ...(setup.valueEstimate ? { valueEstimate: setup.valueEstimate } : {}),
    },
  };
  return { setup, input, result: buildForecast(input), scanId: scan?.id ?? null, scanDate: scan?.finishedAt ?? scan?.startedAt ?? null };
}

/**
 * Keeps today's forecast so it can be held against what happens later. Called
 * after each scan and each change to the inputs. Skips a forecast that cannot
 * be made yet, and one identical to the last kept.
 */
export async function saveForecastSnapshot(db: Db, practiceId: string): Promise<boolean> {
  const [practice] = await db.select({ id: practices.id, forecast: practices.forecast }).from(practices).where(eq(practices.id, practiceId));
  if (!practice) return false;
  const loaded = await loadForecast(db, practice);
  if (!loaded.result.ready) return false;
  const { visits, leads, customers, revenue } = loaded.result.forecast;
  const [last] = await db.select({ input: forecastSnapshots.input, modelVersion: forecastSnapshots.modelVersion })
    .from(forecastSnapshots).where(eq(forecastSnapshots.practiceId, practiceId))
    .orderBy(desc(forecastSnapshots.createdAt)).limit(1);
  if (last && last.modelVersion === FORECAST_MODEL_VERSION && stable(last.input) === stable(loaded.input)) return false;
  await db.insert(forecastSnapshots).values({
    practiceId, scanId: loaded.scanId, modelVersion: FORECAST_MODEL_VERSION,
    input: loaded.input, result: { visits, leads, customers, revenue },
  });
  return true;
}
