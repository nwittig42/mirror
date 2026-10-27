# Revenue Forecast for Free Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Free accounts see the projection with added customers, value per customer and added revenue, built on real search numbers and a per-business value estimate, with the working explained and a call prompt.

**Architecture:** Extend the existing forecast chain (`src/core/forecast.ts`) with a `local_shop` kind and a ranged customer value drawn inside the simulation; draft the value with the existing setup AI call; buy search numbers automatically after the audit setup; render a summary card for free and paid accounts and open the Forecast pages to free accounts.

**Tech Stack:** Next.js 16 app router, Drizzle/Neon (PGlite in tests), Vitest.

**Spec:** docs/superpowers/specs/2026-10-27-revenue-forecast-design.md

## Global Constraints

- Plain, short copy for business owners. Ranges, never one exact promise; "roughly"/"about".
- Every benchmark default names a published source (`Source`), as the header of `src/core/forecast.ts` requires.
- No schema change: `practices.forecast` is jsonb; new `ForecastSetup` fields are optional and default to null via `EMPTY_SETUP`.
- A customer value the owner typed (`valueFrom: "owner"`) is never overwritten by a drafted one.
- Dollars are shown only when `revenueTrusted` is true (see Task 1).
- Run test files one at a time (`npx vitest run <file>`); two at once runs out of memory.
- Commits end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Do not touch `src/app/dashboard/[slug]/preview-summary.tsx` (another session is editing it); Task 5 is done by the controller after that file is committed.

## Review Focus

- A setup saved before this change (no `valueEstimate`, `customerValue` set by owner or prices): must load and forecast exactly as before.
- The drafting AI returns junk or partial value JSON (low > high, negative, strings): parse falls back to no value, never a crash.
- DataForSEO fails during an audit (no credit, bad area): the audit still finishes and emails; the forecast says not ready.
- A free account whose forecast is not ready: the card shows the chart (if any) and a plain waiting line, no zeros and no "$0".
- Monthly-billing businesses: "Worth per customer" says "a month" and revenue keeps today's subscription math.

---

### Task 1: Model — `local_shop`, ranged customer value, trusted revenue

**Files:** Modify `src/core/forecast.ts`; Test `tests/core/forecast.test.ts`.

**Produces:**
- `BusinessType` gains `"local_shop"`, label `"Restaurant, café or shop people visit"`, in `BUSINESS_TYPES` (before `"other"`), `RATE_DEFAULTS.local_shop`:
  - visitToLead `{low: 0.01, likely: 0.03, high: 0.06}`, sources SaasHero (`https://saashero.net/competitor/restaurant-tech-conversion-optimization/`, name "SaasHero, restaurant website conversion rates") and BrightLocal (`https://www.brightlocal.com/research/google-my-business-insights-study/`, name "BrightLocal, Google Business Profile insights study").
  - leadToCustomer `{low: 0.2, likely: 0.4, high: 0.6}`, source Econsultancy (`https://econsultancy.com/google-adwords-new-metric-helps-measure-in-store-conversion/`, name "Google store-visit figures via Econsultancy (nearest available)").
  - `leadNoun("local_shop")` stays `"lead"`; step label for local_shop visit→lead: "Visits that become an order, a call or a direction request"; lead→customer label: "Of those, people who come in or buy".
- `export interface ValueEstimate { spend: Range; visits: Range; basis: string; confidence: "high" | "low" }` — spend per visit in dollars (per month when billing is monthly), visits = purchases in a customer's first year (exactly `{1,1,1}` for monthly billing and one-off jobs).
- `ForecastInput.own.valueEstimate?: ValueEstimate | null`.
- `Forecast` gains `value: Estimate | null` (first-year value per customer, or monthly payment for monthly billing) and `revenueTrusted: boolean`.
- Value used, in order: owner-typed `customerValue` (`valueFrom: "owner"`) → value `ownRange(customerValue)`-style range `{0.8x, x, 1.2x}`; else `valueEstimate` → per draw `draw(spend) × draw(visits)`, likely = spend.likely × visits.likely; else a legacy prices `customerValue` → `{0.5x, x, 1.5x}` and `revenueTrusted = false`; else none.
- `revenueTrusted` = value exists AND (`valueFrom === "owner"` OR (`valueEstimate` present AND `confidence === "high"`)).
- Revenue (non-monthly) is simulated per draw as customers × value, so its range carries both uncertainties; likely = likely customers × likely value. `revenue` stays null for monthly billing (growthPath handles it, using `value.likely`). `revenue` is non-null whenever a value exists (trusted or not); the UI gates on `revenueTrusted`.
- Steps: the value step reads "What a new customer is worth in their first year" with value `roughDollars`-style low/likely/high and note = `basis` + " Read from the prices on your website." (prices) or the existing owner note. Add `export function valueWords(v: Estimate): string` → "$40 to $90" using `roughDollars`.

- [ ] Step 1: Write failing tests in `tests/core/forecast.test.ts`:
  - `local_shop` forecasts with defaults (ready, `customers.likely` equals visits × 0.03 × 0.4 at likely).
  - with `valueEstimate {spend {8,14,20}, visits {2,4,8}, confidence "high"}` → `value.likely === 56`, `revenue.likely ≈ customers.likely × 56`, `revenue.low < customers.likely × 56 < revenue.high`, `revenueTrusted === true`.
  - same with `confidence: "low"` → `revenueTrusted === false`, revenue still computed.
  - owner value 500 with a valueEstimate present → value.likely 500, trusted.
  - legacy input (only `customerValue: 1500, valueFrom: "prices"`, no estimate) → value.likely 1500, `revenueTrusted === false`; every existing test still passes unchanged.
  - same inputs twice → identical output (seeded).
- [ ] Step 2: Run `npx vitest run tests/core/forecast.test.ts` — new tests FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run it — all PASS. `npx tsc --noEmit` clean (fix any exhaustive `Record<BusinessType,…>` maps elsewhere by adding `local_shop`).
- [ ] Step 5: Commit.

### Task 2: Drafting the kind and the value

**Files:** Modify `src/services/forecast.ts`; Test `tests/services/forecast.test.ts` (create if absent; follow the PGlite helper used by `tests/services/prospect-setup.test.ts`).

**Consumes:** Task 1 `ValueEstimate`, `local_shop`.
**Produces:** `ForecastSetup.valueEstimate: ValueEstimate | null` (EMPTY_SETUP null); `SetupDraft.value: { estimate: ValueEstimate; billing: Billing } | null` replacing `price`/`billing`; `loadForecast` passes `valueEstimate` into `input.own`.

- `SETUP_SYSTEM` KIND list gains `local_shop: restaurants, cafés, bakeries, coffee shops, dessert shops, bars and shops people walk into to buy.` and `other` loses "restaurants". Section 4 becomes VALUE: from the stated prices and the kind of business, estimate spend per visit (low/likely/high: a typical order, not the dearest item), purchases in a new customer's first year (low/likely/high; 1 for a one-off job; for a subscription give the monthly price as spend and 1/1/1 visits with billing "monthly"), one plain sentence `basis` naming the prices used, and `confidence` "high" only when the website states prices for what most customers buy, else "low". No prices stated → `"value": null`. For local_shop first-year visits stay within: café/bakery/coffee 2-12 (likely about 4), restaurant 1-6 (likely about 2), shop 1-4.
- JSON shape: `{"kind","area","searches",[...],"value":{"spend":{"low","likely","high"},"visits":{"low","likely","high"},"billing","basis","confidence"}}`.
- `parseSetupDraft`: value is null unless spend and visits are positive finite numbers with low ≤ likely ≤ high, spend.high ≤ 10,000,000, visits.high ≤ 365, basis a non-empty string (trimmed, ≤ 240 chars); confidence anything but "high" → "low"; billing "monthly" forces visits {1,1,1}.
- `draftForecastSetup` stores `valueEstimate`, `customerValue = round(spend.likely × visits.likely, 2)`, `billing`, `valueFrom: "prices"` under the same owner-never-overwritten rule as today; when the owner set the value, `valueEstimate` is left as it was.
- `max_tokens` 1200.

- [ ] Step 1: Failing tests: parse of a full good value; parse of low > high → value null; of missing basis → null; confidence "medium" → "low"; monthly → visits 1/1/1; `local_shop` kind accepted. `draftForecastSetup` with a stub `suggest` stores valueEstimate + customerValue 56 for spend 14 × visits 4, and leaves an owner value and its estimate untouched.
- [ ] Step 2: Run, FAIL. Step 3: implement. Step 4: run, PASS; also `npx vitest run tests/app/forecast.test.tsx` and tsc. Step 5: commit.

### Task 3: Buy search numbers automatically after the audit setup

**Files:** Modify `src/services/forecast.ts` (add `buyDemand`), `src/app/admin/forecast-actions.ts` (use it), `src/services/prospect-start.ts`; Test `tests/services/forecast.test.ts`.

**Produces:** `export async function buyDemand(db: Db, practiceId: string, fetchImpl?: typeof fetch): Promise<"bought" | "skipped">` — loads the setup; returns "skipped" without a request when there is no area, no keywords, or `demandAt` already set; else calls `fetchSearchVolume` and stores keywords + `demandAt` now; throws on DataForSEO errors.
- `buyForecastDemand` (admin) keeps its messages but calls the shared fetch/store path (it must still buy again when the operator clicks, so it does not use the `demandAt` skip — add `opts.force`).
- `prospect-start.ts` `draftForecast` becomes: draft, then `buyDemand(...).catch(err => console.error("[prospect] search numbers not bought", practiceId, err.message))`, then `saveForecastSnapshot(...).catch(() => false)`.

- [ ] Step 1: Failing tests with a stub fetch returning a DataForSEO-shaped body: bought → keywords carry searches, demandAt set; second call → "skipped" and fetch not called; no area → "skipped"; error body 40200 → throws "out of credit".
- [ ] Steps 2-5 as usual; also run `npx vitest run tests/services/prospect-setup.test.ts`.

### Task 4: The forecast summary card, and open the Forecast pages to free accounts

**Files:** Modify `src/app/dashboard/[slug]/forecast-card.tsx`, `src/app/dashboard/[slug]/forecast/page.tsx`, `src/app/dashboard/[slug]/forecast/method/page.tsx`; maybe `src/components/forecast-charts.tsx`; Tests `tests/app/forecast.test.tsx` (+ a card test).

**Consumes:** Task 1 `value`, `revenueTrusted`, `valueWords`; `CallBanner`'s `bookingUrl()` from `src/components/locked.tsx`.

- `ForecastCard` gains prop `free?: boolean`. Card title "Your forecast". Contents in order:
  1. The chart: paid as today; free → only the Recommended-by-AI line (filter `scoreLines` to the visibility key).
  2. A summary row of three figures when the forecast is ready and not ahead, from `growthPath(...).at(-1)`: **Added customers** `wholeNumber(likely)` + "Range a to b" + "in 12 months"; **Worth per customer** `roughDollars(value.likely)` + "Range …" + "first year" (or "a month" when monthly) + the basis sentence under it in small text; **Added revenue** `roughDollars(revenue.likely)` + range + "in 12 months" (monthly billing: "a month by month 12"). When `!revenueTrusted`, the last two figures are replaced by one line: "We'll work out what a customer is worth to you on the call."
  3. `<details>` "How we got this number": the forecast `steps` as a short list — label, value, and origin label (`ORIGIN_LABEL`) — plus a link "See the full working" to `/forecast/method`.
  4. Call prompt row: "These are estimates from public data and industry averages. Schedule a call and we'll put in your real numbers." + a `Schedule a call` link to `bookingUrl()` styled with `buttonClass("gold")`. Shown to free accounts only.
  - Not ready: free → the chart if any plus "Your forecast is still being worked out. Check back after your audit finishes." Returns null only when there is neither chart nor forecast.
- Forecast page and method page: `locked` no longer renders `LockedSection`; free accounts see the year-ahead card and the method page's lead/revenue parts; Accuracy-forecast cards/sections and the "your own numbers" form are hidden for them. The year-ahead revenue tile follows `revenueTrusted`.
- [ ] Step 1: Failing tests: free card shows "Added customers", "Worth per customer", "Added revenue", the basis sentence, "How we got this number", "Schedule a call"; untrusted value → "We'll work out what a customer is worth" and no "$"; free forecast page renders the year ahead (no "Unlocks after your call"); paid card unchanged apart from the summary row.
- [ ] Steps 2-5 as usual.

### Task 5 (controller, after the other session commits): put the card on the free overview

In `src/app/dashboard/[slug]/page.tsx` locked branch and `preview-summary.tsx`: render `<ForecastCard free …/>` right after the "Your score" card; drop "Forecast" from the LOCKED list. Update `tests/app/dashboard-preview.test.tsx`.

### Task 6 (controller): backfill

Re-run `draftForecastSetup(db, id, { overwrite: true })` + `buyDemand` + `saveForecastSnapshot` for Blue Box Bakery and Blue Star Donuts.
