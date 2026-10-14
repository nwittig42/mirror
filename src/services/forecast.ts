import { and, desc, eq, ne } from "drizzle-orm";
import type { Db } from "@/db";
import { facts, forecastSnapshots, practices, prompts } from "@/db/schema";
import { loadEnv } from "@/lib/env";
import { getChecksForScan, getLatestScan } from "@/lib/queries";
import {
  BUSINESS_TYPES, FORECAST_MODEL_VERSION, buildForecast, mentionRates,
  type Billing, type BusinessType, type DemandKeyword, type ForecastInput, type ForecastResult,
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
}

export const EMPTY_SETUP: ForecastSetup = {
  area: null, businessType: "other", keywords: [], demandAt: null,
  visitToLead: null, leadToCustomer: null, customerValue: null, billing: "once", valueFrom: null,
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
- other: anything else, including restaurants and schools. Choose this when unsure.

2. AREA. Where most of its customers come from, in exactly this form: City,State,United States. Use the main city of its metro area, since customers travel in from around it: a clinic in Santa Monica is "Los Angeles,California,United States". A business that sells online or across the country is "United States".

3. SEARCHES. 12 to 20 Google searches a buyer types when they want to hire, book or buy from a business like this. Each 1 to 4 words, lower case, the way people really type. The kind of business, its main services, and "near me" forms. No questions, no "how to", no brand names, no competitor names. Leave the city out: the counts are already taken inside the area. Only what this business sells.

4. PRICE. What one typical new paying customer pays, taken only from prices the website states. Use the most common paid plan or the most common service, not the dearest. If it is a subscription or membership, give the price for one month and "monthly". If it is a job, a visit or an order, give what a typical customer spends in their first year and "once". If no prices are stated, give null: never guess a price.

Answer with JSON only, no other text:
{"kind": "...", "area": "...", "searches": ["...", "..."], "price": 0, "billing": "monthly"}`;

export interface SetupDraft {
  businessType: BusinessType; area: string | null; keywords: string[];
  /** What a typical new customer pays, read off the stated prices. Null when the website states none. */
  price: number | null;
  billing: Billing;
}

/** Reads the AI's answer. Anything it got wrong falls back to the cautious choice: "Something else", no area, no searches. */
export function parseSetupDraft(text: string): SetupDraft {
  let raw: { kind?: unknown; area?: unknown; searches?: unknown; price?: unknown; billing?: unknown } = {};
  try {
    raw = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch { /* not JSON: every field falls back */ }
  const area = typeof raw.area === "string" ? raw.area.split(",").map(part => part.trim()).filter(Boolean).join(",") : "";
  return {
    businessType: (BUSINESS_TYPES as unknown[]).includes(raw.kind) ? (raw.kind as BusinessType) : "other",
    // DataForSEO names every area "..., United States"; anything else would be refused when the numbers are bought.
    area: /(^|,)United States$/.test(area) && area.length <= 120 ? area : null,
    keywords: cleanKeywords(Array.isArray(raw.searches) ? raw.searches.filter(s => typeof s === "string").join("\n") : ""),
    price: typeof raw.price === "number" && raw.price > 0 && raw.price <= 10_000_000 ? Math.round(raw.price * 100) / 100 : null,
    billing: raw.billing === "monthly" ? "monthly" : "once",
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
    body: JSON.stringify({ model: env.ANTHROPIC_MODEL, max_tokens: 800, system: SETUP_SYSTEM, messages: [{ role: "user", content }] }),
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
  await db.update(practices).set({
    forecast: {
      ...setup,
      area,
      businessType: opts.overwrite || fresh ? draft.businessType : setup.businessType,
      keywords: [
        ...setup.keywords.map(k => (moved ? { keyword: k.keyword, searches: null, cpc: null } : k)),
        ...draft.keywords.filter(k => !have.has(k)).map(keyword => ({ keyword, searches: null, cpc: null })),
      ].slice(0, MAX_KEYWORDS),
      demandAt: moved ? null : setup.demandAt,
      // A value the owner typed is never replaced by one read off the website.
      ...(draft.price !== null && setup.valueFrom !== "owner" && (setup.customerValue === null || setup.valueFrom === "prices")
        ? { customerValue: draft.price, billing: draft.billing, valueFrom: "prices" as const } : {}),
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
