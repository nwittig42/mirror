import { describe, it, expect } from "vitest";
import {
  MONTHLY_CHURN, buildForecast, growthPath, mentionRates, rangeWords, roughDollars, wholeNumber,
  type ForecastCheck, type ForecastInput, type MentionRates,
} from "@/core/forecast";

const check = (engine: string, mentioned: boolean, competitors: string[] = [], promptKind = "category"): ForecastCheck =>
  ({ engine, promptKind, mentioned, competitorsMentioned: competitors });

const rates = (over: Partial<MentionRates> = {}): MentionRates =>
  ({ competitor: "Rose City Rooter", answers: 60, assistants: { yours: 0.1, theirs: 0.3 }, aiMode: null, ...over });

const input = (over: Partial<ForecastInput> = {}): ForecastInput => ({
  keywords: [{ keyword: "plumber", searches: 8000, cpc: 20 }, { keyword: "plumber near me", searches: 2000, cpc: 10 }, { keyword: "long odd question", searches: null, cpc: null }],
  rates: rates(), businessType: "home_services", own: {}, ...over,
});

const ready = (i: ForecastInput) => {
  const result = buildForecast(i);
  if (!result.ready) throw new Error(`not ready: ${result.reason}`);
  return result.forecast;
};

describe("mentionRates", () => {
  it("leaves out branded questions and picks the competitor AI names most", () => {
    const r = mentionRates([
      check("openai", true, ["A"]), check("openai", false, ["A", "B"]), check("openai", false, ["B"]), check("openai", false, ["A"]),
      check("openai", true, [], "branded"),
    ]);
    expect(r.answers).toBe(4);
    expect(r.competitor).toBe("A");
    expect(r.assistants).toEqual({ yours: 0.25, theirs: 0.75 });
    expect(r.aiMode).toBeNull();
  });

  it("weights each assistant by how much it is used, so ChatGPT counts far more than Claude", () => {
    const r = mentionRates([check("openai", false, ["A"]), check("anthropic", true, [])]);
    // ChatGPT 0.115 against Claude 0.005: the business is named in 1 of 2 answers but about 4% by weight.
    expect(r.assistants!.yours).toBeCloseTo(0.005 / 0.12, 5);
    expect(r.assistants!.theirs).toBeCloseTo(0.115 / 0.12, 5);
  });

  it("keeps Google AI Mode apart from the assistants", () => {
    const r = mentionRates([check("google", true, ["A"]), check("google", false, ["A"]), check("openai", false, [])]);
    expect(r.aiMode).toEqual({ yours: 0.5, theirs: 1 });
    expect(r.assistants).toEqual({ yours: 0, theirs: 0 });
  });

  it("has no competitor when no answer named one", () => {
    expect(mentionRates([check("openai", true)]).competitor).toBeNull();
  });
});

describe("buildForecast", () => {
  it("matches the sums done by hand at the likely values", () => {
    const f = ready(input());
    // 10,000 searches x 0.14 answers x 20 point gap x 2 visits per 100 x 12 months = 67 visits a year.
    expect(f.monthlySearches).toBe(10_000);
    expect(f.visits.likely).toBeCloseTo(67.2, 5);
    // x 4% to a lead x 25% to a customer.
    expect(f.leads.likely).toBeCloseTo(2.688, 5);
    expect(f.customers.likely).toBeCloseTo(0.672, 5);
  });

  it("gives a range far narrower than multiplying every low and every high", () => {
    const { leads } = ready(input());
    expect(leads.low).toBeLessThan(leads.likely);
    expect(leads.high).toBeGreaterThan(leads.likely);
    // Lows multiplied: 0.05 x 0.005 x 0.02; highs: 0.22 x 0.04 x 0.08. That is 141 times apart.
    expect(leads.high / leads.low).toBeLessThan(40);
    expect(leads.high / leads.low).toBeGreaterThan(5);
  });

  it("prints the same forecast for the same inputs", () => {
    expect(buildForecast(input())).toEqual(buildForecast(input()));
  });

  it("scales in a straight line with search demand", () => {
    const one = ready(input());
    const double = ready(input({ keywords: [{ keyword: "plumber", searches: 20_000, cpc: null }] }));
    expect(double.leads.likely / one.leads.likely).toBeCloseTo(2, 5);
  });

  it("uses the owner's own rates and says so", () => {
    const f = ready(input({ own: { visitToLead: 0.08, leadToCustomer: 0.5, customerValue: 900 } }));
    expect(f.leads.likely).toBeGreaterThan(ready(input()).leads.likely * 1.8);
    expect(f.steps.filter(s => s.origin === "yours").map(s => s.label)).toEqual([
      "Visits that become a lead", "Leads that become a customer", "What a new customer is worth in their first year",
    ]);
    expect(f.revenue!.likely).toBeCloseTo(f.customers.likely * 900, 5);
  });

  it("shows revenue only when the owner gives a customer value, and the cost as ads otherwise", () => {
    const f = ready(input());
    expect(f.revenue).toBeNull();
    // Click price weighted by searches: (8000 x 20 + 2000 x 10) / 10000 = $18.
    expect(f.adCost!.likely).toBeCloseTo(f.visits.likely * 18, 5);
  });

  it("adds Google AI Mode when it was scanned", () => {
    const without = ready(input());
    const withMode = ready(input({ rates: rates({ aiMode: { yours: 0, theirs: 0.2 } }) }));
    expect(withMode.visits.likely).toBeGreaterThan(without.visits.likely * 1.3);
    expect(withMode.steps.some(s => s.label.startsWith("Gap in Google AI Mode"))).toBe(true);
  });

  it("is zero, and says the business is ahead, when there is no gap", () => {
    const f = ready(input({ rates: rates({ assistants: { yours: 0.4, theirs: 0.3 } }) }));
    expect(f.ahead).toBe(true);
    expect(f.leads.high).toBe(0);
  });

  it("works out what today's mention rate implies, to hold against analytics", () => {
    // 10,000 x 0.14 x 10% named x 2 per 100 = 2.8 visits a month.
    const { visitsTodayPerMonth } = ready(input());
    expect(visitsTodayPerMonth.likely).toBeCloseTo(2.8, 5);
  });

  it("labels every step with where its number came from", () => {
    const origins = ready(input()).steps.map(s => s.origin);
    expect(origins).toEqual(["bought", "assumption", "measured", "assumption", "assumption", "assumption"]);
    expect(ready(input()).steps.filter(s => s.origin === "assumption").every(s => s.sources.length > 0)).toBe(true);
  });

  it("does not forecast without search numbers, enough answers, a competitor or usable rates", () => {
    expect(buildForecast(input({ keywords: [{ keyword: "x", searches: null, cpc: null }] }))).toEqual({ ready: false, reason: "no_demand" });
    expect(buildForecast(input({ rates: rates({ answers: 5 }) }))).toEqual({ ready: false, reason: "no_scan" });
    expect(buildForecast(input({ rates: rates({ assistants: null }) }))).toEqual({ ready: false, reason: "no_scan" });
    expect(buildForecast(input({ rates: rates({ competitor: null }) }))).toEqual({ ready: false, reason: "no_competitor" });
    expect(buildForecast(input({ businessType: "other" }))).toEqual({ ready: false, reason: "need_rates" });
    expect(buildForecast(input({ businessType: "other", own: { visitToLead: 0.03, leadToCustomer: 0.2 } })).ready).toBe(true);
  });

  it("counts an online store's order as the customer", () => {
    const f = ready(input({ businessType: "ecommerce" }));
    expect(f.customers.likely).toBeCloseTo(f.leads.likely, 5);
    expect(f.steps.some(s => s.label === "Leads that become a customer")).toBe(false);
  });
});

describe("growthPath", () => {
  const full = { visits: { low: 600, likely: 1200, high: 2400 }, leads: { low: 30, likely: 60, high: 120 }, customers: { low: 6, likely: 12, high: 24 } };

  it("closes the gap at a steady pace, so the first year adds up to just over half a full one", () => {
    const path = growthPath(full, {});
    expect(path).toHaveLength(13);
    expect(path[0].visits.likely).toBe(0);
    // 100 visits a month at full pace, reached a twelfth at a time: 100 x (1 + 2 + ... + 12) / 12 = 650.
    expect(path[12].visits.likely).toBeCloseTo(650, 5);
    expect(path[12].leads).toEqual({ low: 16.25, likely: 32.5, high: 65 });
    // Month 6 is half way: 100 x (1 + ... + 6) / 12 = 175.
    expect(path[6].visits.likely).toBeCloseTo(175, 5);
    expect(path[12].revenue).toBeNull();
  });

  it("counts a customer who pays once at their first-year value", () => {
    const path = growthPath(full, { customerValue: 500, billing: "once" });
    expect(path[12].revenue!.likely).toBeCloseTo(6.5 * 500, 5);
  });

  it("builds monthly revenue from subscribers gained, less those who cancel", () => {
    const path = growthPath(full, { customerValue: 10, billing: "monthly" });
    // Month 1: a twelfth of one customer a month, nobody has had time to cancel.
    expect(path[1].revenue!.likely).toBeCloseTo((1 / 12) * 10, 5);
    // By month 12, 6.5 customers gained; with no one cancelling that would be $65 a month.
    const month12 = path[12].revenue!;
    expect(month12.likely).toBeLessThan(65);
    expect(month12.likely).toBeGreaterThan(65 * (1 - MONTHLY_CHURN.likely) ** 11);
    // The low end pairs the fewest customers with the most cancelling.
    expect(month12.low).toBeLessThan(month12.likely / 2);
    expect(month12.high).toBeGreaterThan(month12.likely * 2);
  });
});

describe("software with a free plan", () => {
  it("counts a free sign-up as the lead and an upgrade as the customer", () => {
    const f = ready(input({ businessType: "freemium", own: { customerValue: 9.99, billing: "monthly", valueFrom: "prices" } }));
    expect(f.steps.map(s => s.label)).toEqual(expect.arrayContaining([
      "Visits that become a free sign-up", "Sign-ups that become paying customers", "What a new customer pays each month",
    ]));
    expect(f.steps.find(s => s.label === "What a new customer pays each month")!.origin).toBe("prices");
    // 13% sign up and 3% of those pay.
    expect(f.customers.likely).toBeCloseTo(f.visits.likely * 0.13 * 0.03, 5);
    // A subscription's revenue is worked out month by month, not as one yearly figure.
    expect(f.revenue).toBeNull();
  });
});

describe("the words", () => {
  it("rounds hard and never prints a decimal", () => {
    expect(wholeNumber(0.3)).toBe("fewer than 1");
    expect(wholeNumber(11.3)).toBe("11");
    expect(rangeWords({ low: 2.4, likely: 11, high: 40.4 })).toBe("2 to 40");
    expect(rangeWords({ low: 0.2, likely: 0.6, high: 3.6 })).toBe("up to 4");
    expect(rangeWords({ low: 0, likely: 0.1, high: 0.3 })).toBe("fewer than 1");
    expect(roughDollars(563)).toBe("$560");
    expect(roughDollars(2236)).toBe("$2,200");
    expect(roughDollars(48_700)).toBe("$49,000");
  });
});
