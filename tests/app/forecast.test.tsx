import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { runScan } from "@/services/scan-runner";
import type { EngineAdapter } from "@/engines/types";

let db: Db;
let role = "client";
// The same rule as the real requirePracticeView: a paused business is locked for its owner, never for an operator.
vi.mock("@/lib/auth", () => ({
  requirePracticeAccess: vi.fn(async (slug: string) => (await db.select().from(schema.practices).where(eq(schema.practices.slug, slug)))[0]),
  requireOperator: vi.fn().mockResolvedValue({ id: "operator-1", role: "operator" }),
  requirePracticeView: vi.fn(async (slug: string) => {
    const [practice] = await db.select().from(schema.practices).where(eq(schema.practices.slug, slug));
    return { practice, locked: !practice.active && role !== "operator" };
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/env", () => ({ loadEnv: () => ({ DATAFORSEO_LOGIN: "login", DATAFORSEO_PASSWORD: "password" }) }));

import ForecastPage from "@/app/dashboard/[slug]/forecast/page";
import ForecastMethodPage from "@/app/dashboard/[slug]/forecast/method/page";
import { saveOwnNumbers } from "@/app/dashboard/[slug]/forecast/actions";
import { buyForecastDemand, saveForecastSetup } from "@/app/admin/forecast-actions";
import { saveProfile } from "@/app/dashboard/[slug]/settings/actions";
import { cleanKeywords, draftForecastSetup, fetchSearchVolume, parseSetupDraft, type ForecastSetup, type suggestSetup } from "@/services/forecast";

const params = Promise.resolve({ slug: "harbor" });
const html = async (page: Promise<React.ReactElement>) => renderToStaticMarkup(await page);
const text = async (page: Promise<React.ReactElement>) => (await html(page)).replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

// AI names the rival in every answer and Harbor in none.
const adapter: EngineAdapter = { name: "openai", run: async () => ({ answer: "Call Rose City Rooter. They are open all night.", citations: [] }) };
const scan = () => runScan(db, practiceId, [adapter], async () => ({ wrong: [], right: [] }), async () => []);
const setup = async (): Promise<ForecastSetup> =>
  (await db.select().from(schema.practices).where(eq(schema.practices.id, practiceId)))[0].forecast!;
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
};
const DEMAND: ForecastSetup = {
  area: "Portland,Oregon,United States", businessType: "home_services", demandAt: "2026-10-13T00:00:00.000Z",
  keywords: [{ keyword: "plumber", searches: 40_000, cpc: 20 }, { keyword: "emergency plumber", searches: 10_000, cpc: 30 }, { keyword: "odd long phrase", searches: null, cpc: null }],
  visitToLead: null, leadToCustomer: null, customerValue: null, billing: "once", valueFrom: null,
};
let practiceId: string;

describe("the forecast", () => {
  beforeEach(async () => {
    role = "client";
    db = await makeTestDb();
    setDbForTests(db);
    ({ practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing", slug: "harbor", competitors: ["Rose City Rooter"],
      prompts: Array.from({ length: 12 }, (_, i) => ({ text: `Who is the best plumber in Portland for job ${i}?`, kind: "category" as const })),
    }));
  });

  it("waits, in plain words, until search numbers have been bought", async () => {
    await scan();
    const page = await text(ForecastPage({ params }));
    expect(page).toContain("Not ready yet. We are still collecting how many people search");
    expect(page).not.toContain("in the next 12 months");
    expect(page).not.toContain("How we got this number");
  });

  it("shows a likely figure with its range and the condition beside it", async () => {
    await db.update(schema.practices).set({ forecast: DEMAND }).where(eq(schema.practices.id, practiceId));
    await scan();
    const page = await text(ForecastPage({ params }));
    expect(page).toContain("If AI came to name you as often as it names Rose City Rooter, at a steady pace over 12 months");
    expect(page).toMatch(/About \d+ more leads and \d+ more customers in the next 12 months/);
    for (const tile of ["Visits from AI", "Leads", "New customers", "Worth as Google ads"]) expect(page).toContain(tile);
    expect(page).toMatch(/Range [\d,]+ to [\d,]+/);
    expect(page).toContain("It is not a promise of what you will get, or of what our work will deliver.");
    expect(page).not.toMatch(/guarantee|proven|will get you|you are losing/i);
  });

  it("explains every step, where each number came from and what is left out", async () => {
    await db.update(schema.practices).set({ forecast: DEMAND }).where(eq(schema.practices.id, practiceId));
    await scan();
    const page = await text(ForecastMethodPage({ params }));
    expect(page).toContain("50,000");
    expect(page).toContain("Gap in AI assistants: Rose City Rooter named in 100% of answers, you in 0%");
    for (const label of ["Bought data", "Measured by Mirror", "Industry assumption"]) expect(page).toContain(label);
    expect(page).toContain("What is not counted");
    expect(page).toContain("1 search Google has no number for is left out.");
    expect(page).toContain("we do not claim an accuracy figure");
    expect(await html(ForecastMethodPage({ params }))).toContain("https://www.tryprofound.com/blog/the-ai-mention-effect");
  });

  it("keeps a copy of the forecast each scan produces, once", async () => {
    await db.update(schema.practices).set({ forecast: DEMAND }).where(eq(schema.practices.id, practiceId));
    await scan();
    await scan();
    const kept = await db.select().from(schema.forecastSnapshots);
    // The second scan measured the same rates from the same inputs, so there is nothing new to keep.
    expect(kept).toHaveLength(1);
    expect(kept[0].result.leads.likely).toBeGreaterThan(0);
    expect(kept[0].input.rates.competitor).toBe("Rose City Rooter");
  });

  it("uses the owner's own numbers once saved, and shows revenue", async () => {
    await db.update(schema.practices).set({ forecast: DEMAND }).where(eq(schema.practices.id, practiceId));
    await scan();
    await saveOwnNumbers("harbor", form({ visitToLead: "6%", leadToCustomer: "40", customerValue: "$1,200" }));
    expect(await setup()).toMatchObject({ visitToLead: 0.06, leadToCustomer: 0.4, customerValue: 1200, area: DEMAND.area });
    const page = await text(ForecastPage({ params }));
    expect(page).toContain("Revenue");
    expect(page).not.toContain("Worth as Google ads");
    expect(await text(ForecastMethodPage({ params }))).toContain("Your number");
    expect(await db.select().from(schema.forecastSnapshots)).toHaveLength(2);

    await saveOwnNumbers("harbor", form({ visitToLead: "", leadToCustomer: "abc", customerValue: "-5" }));
    expect(await setup()).toMatchObject({ visitToLead: null, leadToCustomer: null, customerValue: null });
  });

  it("forecasts Accuracy from the wrong facts the scan found, even before any search numbers exist", async () => {
    await db.insert(schema.facts).values({ practiceId, category: "pricing", label: "Call-out fee", value: "$89", status: "active" });
    const judge = async () => ({ wrong: [{ claim: "Harbor charges $49", factLabel: "Call-out fee", severity: "major" as const }], right: [] });
    await runScan(db, practiceId, [{ name: "openai", run: async () => ({ answer: "Harbor Plumbing charges $49. Rose City Rooter is good too.", citations: ["https://www.harbor.example/prices"] }) }], judge, async () => []);
    await db.update(schema.practices).set({ website: "https://www.harbor.example" }).where(eq(schema.practices.id, practiceId));

    const page = await text(ForecastPage({ params }));
    // One wrong price costs 18 raw points: the whole 13-point gap on screen (87 to 100); read on their own site, three quarters of it is expected back in 3 months, nine tenths in 12.
    // Every number is on the shown 30-100 scale: raw 82, 96, 98, 96 to 99.
    expect(page).toContain("Accuracy: 87 today, about 97 in 3 months and 99 in 12 (range 97 to 99; 100 with every wrong fact gone)");
    // All three scores are on the chart, with today's value and where each is heading.
    for (const line of ["Overall", "Recommended by AI", "Accuracy 87 → 99"]) expect(page).toContain(line);
    expect(page).toContain("Read on your own website · 1 wrong fact 13 points");
    expect(page).toContain("Not ready yet. We are still collecting how many people search");
    // Each score keeps its Overview colour.
    const markup = await html(ForecastPage({ params }));
    for (const colour of ["stroke-ring-facts", "stroke-ring-visibility", "stroke-ring-overall"]) expect(markup).toContain(colour);

    const method = await text(ForecastMethodPage({ params }));
    expect(method).toContain("The Accuracy forecast");
    expect(method).toContain("These chances are our estimates");
    expect(method).toContain("Call-out fee Read on your own website 13");
    // The penalties and the floor, on the same scale as the score.
    expect(method).toContain("about 18 points for a serious one, about 8 for an important one, about 3 for a minor one");
    expect(method).toContain("30 while AI never names you, and held at 79");
  });

  it("shows a prospect before their call the locked card and none of the numbers", async () => {
    await db.update(schema.practices).set({ forecast: DEMAND }).where(eq(schema.practices.id, practiceId));
    await scan();
    await db.update(schema.practices).set({ active: false }).where(eq(schema.practices.id, practiceId));
    for (const page of [await text(ForecastPage({ params })), await text(ForecastMethodPage({ params }))]) {
      expect(page).toContain("Unlocks after your call");
      expect(page).not.toContain("Rose City Rooter");
      expect(page).not.toMatch(/in the next 12 months|50,000|Accuracy|Recommended by AI/);
    }
    await saveOwnNumbers("harbor", form({ visitToLead: "50" }));
    expect((await setup()).visitToLead).toBeNull();
  });
});

describe("forecast setup", () => {
  beforeEach(async () => {
    db = await makeTestDb();
    setDbForTests(db);
    ({ practiceId } = await seedPractice(db, { name: "Harbor Plumbing", slug: "harbor" }));
  });

  it("lets the owner correct their own profile, and clears search numbers when the area changes", async () => {
    await db.update(schema.practices).set({ forecast: DEMAND, website: "https://www.harbor.example" }).where(eq(schema.practices.id, practiceId));
    await saveProfile("harbor", form({
      website: "harborplumbing.example", category: "Plumber", location: "Portland, OR", businessType: "home_services",
      area: "Portland, Oregon, United States", keywords: "plumber\ndrain cleaning",
    }));
    const [saved] = await db.select().from(schema.practices).where(eq(schema.practices.id, practiceId));
    expect(saved).toMatchObject({ website: "https://harborplumbing.example", category: "Plumber", location: "Portland, OR" });
    expect(saved.forecast).toMatchObject({
      area: DEMAND.area, demandAt: DEMAND.demandAt,
      keywords: [{ keyword: "plumber", searches: 40_000, cpc: 20 }, { keyword: "drain cleaning", searches: null, cpc: null }],
    });
    const [note] = await db.select().from(schema.activities).where(eq(schema.activities.practiceId, practiceId));
    expect(note).toMatchObject({ visibility: "internal", description: "profile edited from the dashboard: website, kind of business, city, searches" });

    // A blank or broken website keeps the old one; a new area drops the numbers counted in the old one.
    await saveProfile("harbor", form({ website: "", category: "", location: "", businessType: "nonsense", area: "United States", keywords: "plumber" }));
    const [again] = await db.select().from(schema.practices).where(eq(schema.practices.id, practiceId));
    expect(again).toMatchObject({ website: "https://harborplumbing.example", category: null, location: null });
    expect(again.forecast).toMatchObject({ businessType: "home_services", area: "United States", demandAt: null, keywords: [{ keyword: "plumber", searches: null, cpc: null }] });
  });

  it("tidies typed searches: one each, lower case, nothing Google would refuse", () => {
    expect(cleanKeywords("Plumber\n plumber \nEmergency  Plumber!, drain cleaning\n\n" + "word ".repeat(11)))
      .toEqual(["plumber", "emergency plumber", "drain cleaning"]);
  });

  it("keeps a search's number when the list is saved again, and drops every number when the area changes", async () => {
    await db.update(schema.practices).set({ forecast: DEMAND }).where(eq(schema.practices.id, practiceId));
    await saveForecastSetup(practiceId, { area: "Portland, Oregon, United States", businessType: "home_services", keywords: "plumber\nwater heater repair" });
    expect(await setup()).toMatchObject({
      area: "Portland,Oregon,United States", demandAt: DEMAND.demandAt,
      keywords: [{ keyword: "plumber", searches: 40_000, cpc: 20 }, { keyword: "water heater repair", searches: null, cpc: null }],
    });
    await saveForecastSetup(practiceId, { area: "Seattle,Washington,United States", businessType: "nonsense", keywords: "plumber" });
    expect(await setup()).toMatchObject({ businessType: "other", demandAt: null, keywords: [{ keyword: "plumber", searches: null, cpc: null }] });
  });

  it("reads the AI's pick of kind, area and searches, and falls back to the cautious choice on anything odd", () => {
    expect(parseSetupDraft('Here you go: {"kind": "home_services", "area": "Portland, Oregon, United States", "searches": ["Plumber", "drain cleaning", 7]}'))
      .toEqual({ businessType: "home_services", area: "Portland,Oregon,United States", keywords: ["plumber", "drain cleaning"], price: null, billing: "once" });
    expect(parseSetupDraft('{"kind": "freemium", "area": "United States", "searches": [], "price": 9.99, "billing": "monthly"}'))
      .toEqual({ businessType: "freemium", area: "United States", keywords: [], price: 9.99, billing: "monthly" });
    expect(parseSetupDraft('{"kind": "bakery", "area": "Portland", "searches": "plumber", "price": "cheap", "billing": "weekly"}')).toEqual({ businessType: "other", area: null, keywords: [], price: null, billing: "once" });
    expect(parseSetupDraft("I could not tell.")).toEqual({ businessType: "other", area: null, keywords: [], price: null, billing: "once" });
  });

  it("drafts the setup from the Fact Sheet and questions, without overwriting what the operator chose", async () => {
    const suggest = vi.fn<typeof suggestSetup>(async () => ({ businessType: "home_services", area: "Portland,Oregon,United States", keywords: ["plumber", "drain cleaning"], price: 450, billing: "once" }));
    // Nothing known about the business yet: nothing to draft from, and the AI is not asked.
    expect(await draftForecastSetup(db, practiceId, { suggest })).toBe(false);
    expect(suggest).not.toHaveBeenCalled();

    await db.insert(schema.facts).values({ practiceId, category: "services", label: "Drain cleaning", value: "From $149", status: "draft" });
    expect(await draftForecastSetup(db, practiceId, { suggest })).toBe(true);
    expect(suggest.mock.calls[0][0]).toMatchObject({ name: "Harbor Plumbing", facts: ["Drain cleaning: From $149"] });
    expect(await setup()).toMatchObject({
      businessType: "home_services", area: "Portland,Oregon,United States",
      keywords: [{ keyword: "plumber", searches: null, cpc: null }, { keyword: "drain cleaning", searches: null, cpc: null }],
    });

    // The price read off the Fact Sheet is used, marked as that.
    expect(await setup()).toMatchObject({ customerValue: 450, billing: "once", valueFrom: "prices" });

    // The operator corrects the kind and buys numbers; a later draft adds searches and leaves the rest alone.
    await db.update(schema.practices).set({ forecast: { ...DEMAND, businessType: "legal" } }).where(eq(schema.practices.id, practiceId));
    suggest.mockResolvedValueOnce({ businessType: "clinic", area: "Seattle,Washington,United States", keywords: ["plumber", "water heater repair"], price: 600, billing: "once" });
    await draftForecastSetup(db, practiceId, { suggest });
    const kept = await setup();
    expect(kept).toMatchObject({ businessType: "legal", area: DEMAND.area, demandAt: DEMAND.demandAt });
    // DEMAND carried no value, so the newly read price fills it; once the owner types one, a later read never replaces it.
    expect(kept).toMatchObject({ customerValue: 600, valueFrom: "prices" });
    await saveOwnNumbers("harbor", form({ customerValue: "900", billing: "once" }));
    suggest.mockResolvedValueOnce({ businessType: "clinic", area: DEMAND.area!, keywords: [], price: 123, billing: "monthly" });
    await draftForecastSetup(db, practiceId, { suggest });
    expect(await setup()).toMatchObject({ customerValue: 900, billing: "once", valueFrom: "owner" });
    expect(kept.keywords.map(k => [k.keyword, k.searches])).toEqual([["plumber", 40_000], ["emergency plumber", 10_000], ["odd long phrase", null], ["water heater repair", null]]);

    // Asked for on purpose, it replaces the kind and the area, and a new area drops the old numbers.
    suggest.mockResolvedValueOnce({ businessType: "clinic", area: "Seattle,Washington,United States", keywords: [], price: null, billing: "once" });
    await draftForecastSetup(db, practiceId, { suggest, overwrite: true });
    expect(await setup()).toMatchObject({ businessType: "clinic", area: "Seattle,Washington,United States", demandAt: null });
    expect((await setup()).keywords.every(k => k.searches === null)).toBe(true);
  });

  it("reads DataForSEO's counts, and leaves a search it has no number for empty", async () => {
    const fake = vi.fn(async () => new Response(JSON.stringify({
      status_code: 20000,
      tasks: [{ status_code: 20000, result: [{ keyword: "plumber", search_volume: 4400, cpc: 21.5 }, { keyword: "odd phrase", search_volume: null, cpc: null }] }],
    })));
    expect(await fetchSearchVolume(["plumber", "odd phrase"], "Portland,Oregon,United States", fake as unknown as typeof fetch)).toEqual([
      { keyword: "plumber", searches: 4400, cpc: 21.5 }, { keyword: "odd phrase", searches: null, cpc: null },
    ]);
    expect(JSON.parse((fake.mock.calls[0] as unknown as [string, { body: string }])[1].body)).toEqual([
      { keywords: ["plumber", "odd phrase"], location_name: "Portland,Oregon,United States", language_code: "en" },
    ]);
  });

  it("says plainly when the account is out of credit or the area is not one DataForSEO knows", async () => {
    const answer = (task: object) => (async () => new Response(JSON.stringify({ status_code: 20000, tasks: [task] }))) as unknown as typeof fetch;
    await expect(fetchSearchVolume(["plumber"], "X", answer({ status_code: 40200, status_message: "Payment Required." })))
      .rejects.toThrow("out of credit");
    await expect(fetchSearchVolume(["plumber"], "Nowhere", answer({ status_code: 40501, status_message: "Invalid Field: 'location_name'." })))
      .rejects.toThrow('does not know the area "Nowhere"');
  });

  it("will not buy numbers before the area and the searches are set", async () => {
    const { redirect } = await import("next/navigation");
    await buyForecastDemand(practiceId);
    expect(vi.mocked(redirect).mock.calls.at(-1)![0]).toContain("forecastError=Set+the+area+first.");
  });
});
