import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";
import { makeTestDb, seedPractice } from "../helpers/db";
import { setDbForTests } from "@/db";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { runScan } from "@/services/scan-runner";
import type { EngineAdapter } from "@/engines/types";
import type { ForecastSetup } from "@/services/forecast";
import { ForecastCard } from "@/app/dashboard/[slug]/forecast-card";

let db: Db;
let practiceId: string;

// AI names the rival in every answer and Harbor in none.
const adapter: EngineAdapter = { name: "openai", run: async () => ({ answer: "Call Rose City Rooter. They are open all night.", citations: [] }) };
const scan = () => runScan(db, practiceId, [adapter], async () => ({ wrong: [], right: [] }), async () => []);

const DEMAND: ForecastSetup = {
  area: "Portland,Oregon,United States", businessType: "home_services", demandAt: "2026-10-13T00:00:00.000Z",
  keywords: [{ keyword: "plumber", searches: 40_000, cpc: 20 }, { keyword: "emergency plumber", searches: 10_000, cpc: 30 }],
  visitToLead: null, leadToCustomer: null, customerValue: null, billing: "once", valueFrom: null, valueEstimate: null,
};
const BASIS = "Most jobs are a drain clearing at $150 to $300; a few are repipes at $2,000 or more.";
/** A value drafted from the website's prices. */
const drafted = (confidence: "high" | "low", billing: "once" | "monthly" = "once"): ForecastSetup => ({
  ...DEMAND, billing, customerValue: 250, valueFrom: "prices",
  valueEstimate: { spend: { low: 150, likely: 250, high: 400 }, visits: { low: 1, likely: 1, high: 1.5 }, basis: BASIS, confidence },
});

const card = async (free: boolean) => {
  const [practice] = await db.select().from(schema.practices).where(eq(schema.practices.id, practiceId));
  const element = await ForecastCard({ slug: "harbor", practice, free });
  return element ? renderToStaticMarkup(element) : "";
};
const words = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const setForecast = (forecast: ForecastSetup) => db.update(schema.practices).set({ forecast }).where(eq(schema.practices.id, practiceId));

describe("the forecast card", () => {
  beforeEach(async () => {
    db = await makeTestDb();
    setDbForTests(db);
    ({ practiceId } = await seedPractice(db, {
      name: "Harbor Plumbing", slug: "harbor", competitors: ["Rose City Rooter"],
      prompts: Array.from({ length: 12 }, (_, i) => ({ text: `Who is the best plumber in Portland for job ${i}?`, kind: "category" as const })),
    }));
  });

  it("gives a free account added customers, worth per customer and added revenue, the working, and the call", async () => {
    await setForecast(drafted("high"));
    await scan();
    const markup = await card(true);
    const text = words(markup);
    expect(text).toContain("Your forecast");
    for (const label of ["Added customers", "Worth per customer", "Added revenue", "first year", "in 12 months"]) expect(text).toContain(label);
    expect(text).toMatch(/Added customers \d+ Range [\d,]+ to [\d,]+/);
    expect(text).toMatch(/Worth per customer \$[\d,]+ Range \$[\d,]+ to \$[\d,]+/);
    expect(text).toMatch(/Added revenue \$[\d,]+ Range \$[\d,]+ to \$[\d,]+/);
    expect(text).toContain(BASIS);
    // The working is folded away, each step with where its number came from.
    expect(markup).toMatch(/<details[^>]*><summary[^>]*>How we got this number/);
    expect(markup).not.toMatch(/<details[^>]*open/);
    expect(text).toContain("Searches a month for what you sell, in your area");
    expect(text).toContain("Bought data");
    expect(markup).toContain('href="/dashboard/harbor/forecast/method"');
    expect(text).toContain("See the full working");
    expect(text).toContain("These are estimates from public data and industry averages. Schedule a call and we'll put in your real numbers.");
    expect(markup).toMatch(/<a href="[^"]+"[^>]*>Schedule a call<\/a>/);
    // Only the Recommended-by-AI line: Overall and Accuracy rest on facts not yet confirmed.
    expect(text).toContain("Recommended by AI");
    expect(text).not.toMatch(/Overall|Accuracy/);
  });

  it("shows no dollars when the value is not one we can stand behind", async () => {
    await setForecast(drafted("low"));
    await scan();
    const text = words(await card(true));
    expect(text).toContain("Added customers");
    expect(text).toContain("We'll work out what a customer is worth to you on the call.");
    expect(text).not.toContain("Worth per customer");
    expect(text).not.toContain("Added revenue");
    expect(text).not.toContain("$");
  });

  it("says a month for a business paid monthly", async () => {
    await setForecast(drafted("high", "monthly"));
    await scan();
    const text = words(await card(true));
    expect(text).toMatch(/Worth per customer \$[\d,]+ Range \$[\d,]+ to \$[\d,]+ a month/);
    expect(text).toContain("a month, a year from now");
    expect(text).not.toContain("by month 12");
  });

  it("drops the range when there is only one figure, and never pairs 'Under $10' with a range", async () => {
    // A value the owner typed is one figure, not a range.
    await setForecast({ ...DEMAND, customerValue: 450, valueFrom: "owner" });
    await scan();
    expect(words(await card(false))).toMatch(/Worth per customer \$450 first year Added revenue/);

    // A few dollars a customer: the range alone, no "Under $10" beside it.
    await setForecast({ ...drafted("high"), valueEstimate: { ...drafted("high").valueEstimate!, spend: { low: 2, likely: 4, high: 300 } } });
    const text = words(await card(true));
    expect(text).not.toMatch(/Under \$10 Range/);
    expect(text).toMatch(/Worth per customer Up to \$[\d,]+ first year/);
  });

  it("counts orders for an online store, each worth one order", async () => {
    await setForecast({
      ...drafted("high"), businessType: "ecommerce",
      valueEstimate: { spend: { low: 30, likely: 40, high: 60 }, visits: { low: 1, likely: 1, high: 1 }, basis: "Most orders are $30 to $60.", confidence: "high" },
    });
    await scan();
    const text = words(await card(true));
    expect(text).toContain("Added orders");
    expect(text).toMatch(/Worth per order \$40 Range \$[\d,]+ to \$[\d,]+ an order/);
    expect(text).not.toContain("Added customers");
  });

  it("says the work now is keeping it that way when AI already names them as often", async () => {
    await setForecast(drafted("high"));
    const both: EngineAdapter = { name: "openai", run: async () => ({ answer: "Call Harbor Plumbing or Rose City Rooter.", citations: [] }) };
    await runScan(db, practiceId, [both], async () => ({ wrong: [], right: [] }), async () => []);
    const text = words(await card(true));
    expect(text).toContain("The work now is keeping it that way.");
    expect(text).not.toContain("Holding that position");
  });

  it("waits in plain words, with no zeros, while the forecast is not ready", async () => {
    await scan();
    const text = words(await card(true));
    expect(text).toContain("We're still collecting how many people search for what you sell. Check back soon.");
    expect(text).toContain("Recommended by AI");
    expect(text).not.toMatch(/\$|Added customers/);
  });

  it("says why it is waiting: no competitor named, or numbers only the owner has", async () => {
    await setForecast(DEMAND);
    const nobody: EngineAdapter = { name: "openai", run: async () => ({ answer: "Call Harbor Plumbing.", citations: [] }) };
    await runScan(db, practiceId, [nobody], async () => ({ wrong: [], right: [] }), async () => []);
    expect(words(await card(true))).toContain("AI named no competitor in your audit, so there's no one to compare you with yet.");

    await setForecast({ ...DEMAND, businessType: "other" });
    await scan();
    expect(words(await card(true))).toContain("We need a couple of numbers from you to forecast this. We'll get them on the call.");
    const paid = words(await card(false));
    expect(paid).toContain("Add them on the Forecast page");
    expect(paid).not.toContain("on the call");
  });

  it("shows nothing when there is neither a chart nor a forecast", async () => {
    expect(await card(true)).toBe("");
    expect(await card(false)).toBe("");
  });

  it("keeps a paying client's chart whole and leaves out the call", async () => {
    await setForecast(drafted("high"));
    await scan();
    const text = words(await card(false));
    expect(text).toContain("Overall");
    expect(text).toContain("Added revenue");
    expect(text).toContain("How we got this number");
    expect(text).not.toContain("Schedule a call");
  });
});
