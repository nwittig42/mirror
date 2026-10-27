import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import type { Db } from "@/db";
import * as schema from "@/db/schema";

vi.mock("@/lib/env", () => ({ loadEnv: () => ({ DATAFORSEO_LOGIN: "login", DATAFORSEO_PASSWORD: "password" }) }));

import { EMPTY_SETUP, buyDemand, draftForecastSetup, prepareForecast, parseSetupDraft, type ForecastSetup, type SetupDraft, type suggestSetup } from "@/services/forecast";

const VALUE = {
  spend: { low: 8, likely: 14, high: 20 }, visits: { low: 2, likely: 4, high: 8 },
  billing: "once", basis: "Most orders are pastries and coffee at $8 to $20.", confidence: "high",
};
const answer = (value: unknown, kind = "local_shop") =>
  JSON.stringify({ kind, area: "Portland, Oregon, United States", searches: ["bakery", "cake shop"], value });

describe("reading the drafted value", () => {
  it("reads a full value with its working", () => {
    expect(parseSetupDraft(answer(VALUE))).toEqual({
      businessType: "local_shop", area: "Portland,Oregon,United States", keywords: ["bakery", "cake shop"],
      value: {
        estimate: { spend: VALUE.spend, visits: VALUE.visits, basis: VALUE.basis, confidence: "high" },
        billing: "once",
      },
    });
  });

  it("drops a value whose range is out of order, negative, or not numbers", () => {
    expect(parseSetupDraft(answer({ ...VALUE, spend: { low: 20, likely: 14, high: 8 } })).value).toBeNull();
    expect(parseSetupDraft(answer({ ...VALUE, visits: { low: -1, likely: 4, high: 8 } })).value).toBeNull();
    expect(parseSetupDraft(answer({ ...VALUE, spend: { low: "8", likely: 14, high: 20 } })).value).toBeNull();
    expect(parseSetupDraft(answer({ ...VALUE, visits: { low: 1, likely: 4, high: 400 } })).value).toBeNull();
    // A customer buys at least once.
    expect(parseSetupDraft(answer({ ...VALUE, visits: { low: 0.5, likely: 4, high: 8 } })).value).toBeNull();
    expect(parseSetupDraft(answer({ ...VALUE, spend: undefined })).value).toBeNull();
    expect(parseSetupDraft(answer("cheap")).value).toBeNull();
    expect(parseSetupDraft(answer(null)).value).toBeNull();
  });

  it("drops a value with no basis, and trims a long one", () => {
    expect(parseSetupDraft(answer({ ...VALUE, basis: undefined })).value).toBeNull();
    expect(parseSetupDraft(answer({ ...VALUE, basis: "   " })).value).toBeNull();
    expect(parseSetupDraft(answer({ ...VALUE, basis: `  ${"x".repeat(300)}  ` })).value!.estimate.basis).toHaveLength(240);
  });

  it("treats anything but high confidence as low", () => {
    expect(parseSetupDraft(answer({ ...VALUE, confidence: "medium" })).value!.estimate.confidence).toBe("low");
    expect(parseSetupDraft(answer({ ...VALUE, confidence: undefined })).value!.estimate.confidence).toBe("low");
  });

  it("counts one payment a month for a subscription", () => {
    const draft = parseSetupDraft(answer({ ...VALUE, spend: { low: 9.99, likely: 9.99, high: 9.99 }, billing: "monthly" }, "freemium"));
    expect(draft.value).toMatchObject({ billing: "monthly", estimate: { visits: { low: 1, likely: 1, high: 1 } } });
  });
});

describe("drafting the value", () => {
  let db: Db;
  let practiceId: string;
  const setup = async (): Promise<ForecastSetup> =>
    (await db.select().from(schema.practices).where(eq(schema.practices.id, practiceId)))[0].forecast!;
  const draft = (over: Partial<SetupDraft> = {}): SetupDraft => ({
    businessType: "local_shop", area: "Portland,Oregon,United States", keywords: ["bakery"],
    value: { estimate: { spend: VALUE.spend, visits: VALUE.visits, basis: VALUE.basis, confidence: "high" }, billing: "once" },
    ...over,
  });

  beforeEach(async () => {
    db = await makeTestDb();
    ({ practiceId } = await seedPractice(db, {
      name: "Blue Box Bakery", category: "Bakery",
      facts: [{ category: "pricing", label: "Croissant", value: "$4.50" }],
    }));
  });

  it("stores the estimate and its likely first-year value", async () => {
    const suggest = vi.fn<typeof suggestSetup>(async () => draft());
    expect(await draftForecastSetup(db, practiceId, { suggest })).toBe(true);
    expect(await setup()).toMatchObject({
      businessType: "local_shop", customerValue: 56, billing: "once", valueFrom: "prices",
      valueEstimate: { spend: VALUE.spend, visits: VALUE.visits, basis: VALUE.basis, confidence: "high" },
    });
  });

  it("leaves a value the owner typed, and its estimate, as they were", async () => {
    const before = { spend: { low: 1, likely: 2, high: 3 }, visits: { low: 1, likely: 1, high: 1 }, basis: "Old.", confidence: "low" as const };
    await db.update(schema.practices).set({
      forecast: { ...EMPTY_SETUP, businessType: "local_shop", customerValue: 900, billing: "once", valueFrom: "owner", valueEstimate: before },
    }).where(eq(schema.practices.id, practiceId));
    await draftForecastSetup(db, practiceId, { suggest: async () => draft(), overwrite: true });
    expect(await setup()).toMatchObject({ customerValue: 900, valueFrom: "owner", valueEstimate: before });
  });

  it("keeps an earlier value when the website states no prices", async () => {
    await draftForecastSetup(db, practiceId, { suggest: async () => draft() });
    await draftForecastSetup(db, practiceId, { suggest: async () => draft({ value: null }) });
    expect(await setup()).toMatchObject({ customerValue: 56, valueFrom: "prices" });
  });
});

describe("buying the search numbers", () => {
  let db: Db;
  let practiceId: string;
  const setup = async (): Promise<ForecastSetup> =>
    (await db.select().from(schema.practices).where(eq(schema.practices.id, practiceId)))[0].forecast!;
  const store = (over: Partial<ForecastSetup>) => db.update(schema.practices).set({
    forecast: {
      ...EMPTY_SETUP, area: "Portland,Oregon,United States", businessType: "local_shop",
      keywords: [{ keyword: "bakery", searches: null, cpc: null }, { keyword: "cake shop", searches: null, cpc: null }], ...over,
    },
  }).where(eq(schema.practices.id, practiceId));
  // DataForSEO's answer for a good request.
  const fake = () => vi.fn(async () => new Response(JSON.stringify({
    status_code: 20000,
    tasks: [{ status_code: 20000, result: [{ keyword: "bakery", search_volume: 9900, cpc: 1.2 }, { keyword: "cake shop", search_volume: 880, cpc: null }] }],
  })));

  beforeEach(async () => {
    db = await makeTestDb();
    ({ practiceId } = await seedPractice(db, { name: "Blue Box Bakery" }));
  });

  it("buys the numbers once, and skips a second time", async () => {
    await store({});
    const fetchImpl = fake();
    expect(await buyDemand(db, practiceId, fetchImpl as unknown as typeof fetch)).toBe("bought");
    const bought = await setup();
    expect(bought.keywords).toEqual([{ keyword: "bakery", searches: 9900, cpc: 1.2 }, { keyword: "cake shop", searches: 880, cpc: null }]);
    expect(Date.now() - Date.parse(bought.demandAt!)).toBeLessThan(60_000);

    const again = fake();
    expect(await buyDemand(db, practiceId, again as unknown as typeof fetch)).toBe("skipped");
    expect(again).not.toHaveBeenCalled();
    // Asked for on purpose, it buys again.
    expect(await buyDemand(db, practiceId, again as unknown as typeof fetch, { force: true })).toBe("bought");
    expect(again).toHaveBeenCalledTimes(1);
  });

  it("buys again when a search has no number yet, even after an earlier purchase", async () => {
    await store({ demandAt: "2026-10-01T00:00:00.000Z", keywords: [{ keyword: "bakery", searches: 9900, cpc: 1.2 }, { keyword: "cake shop", searches: null, cpc: null }] });
    const fetchImpl = fake();
    expect(await buyDemand(db, practiceId, fetchImpl as unknown as typeof fetch)).toBe("bought");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // A request that hangs is given up on.
    expect((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].signal).toBeInstanceOf(AbortSignal);
    // Every search counted: nothing to buy, whatever the date says.
    await store({ demandAt: null, keywords: [{ keyword: "bakery", searches: 9900, cpc: 1.2 }] });
    expect(await buyDemand(db, practiceId, fetchImpl as unknown as typeof fetch)).toBe("skipped");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("skips without asking when there is no area or no searches", async () => {
    const fetchImpl = fake();
    await store({ area: null });
    expect(await buyDemand(db, practiceId, fetchImpl as unknown as typeof fetch)).toBe("skipped");
    await store({ keywords: [] });
    expect(await buyDemand(db, practiceId, fetchImpl as unknown as typeof fetch)).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("says plainly when the account is out of credit, and stores nothing", async () => {
    await store({});
    const broke = (async () => new Response(JSON.stringify({ status_code: 20000, tasks: [{ status_code: 40200, status_message: "Payment Required." }] }))) as unknown as typeof fetch;
    await expect(buyDemand(db, practiceId, broke)).rejects.toThrow("out of credit");
    expect((await setup()).demandAt).toBeNull();
  });
});

describe("setting up a prospect's forecast", () => {
  it("drafts, tries to buy the numbers and keeps a snapshot, carrying on when the purchase fails", async () => {
    const calls: string[] = [];
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const db = {} as Db;
    await expect(prepareForecast(db, "p1", {
      draft: async () => { calls.push("draft"); return true; },
      buy: async () => { calls.push("buy"); throw new Error("The DataForSEO account is out of credit."); },
      snapshot: async () => { calls.push("snapshot"); return false; },
    })).resolves.toBeUndefined();
    expect(calls).toEqual(["draft", "buy", "snapshot"]);
    expect(errors).toHaveBeenCalledWith("[prospect] search numbers not bought", "p1", "The DataForSEO account is out of credit.");
    errors.mockRestore();
  });
});
