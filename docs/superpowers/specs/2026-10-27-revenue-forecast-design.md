# Revenue forecast for free accounts — design

## Intent

Nick liked the projection graph and wants it back for free accounts, tied to
money: how many more customers, what each is worth, and the added revenue.
There is "not a lot of room for error": the figure has to fit the specific
business and its business model, the working has to be explained, and it
should lead into a call where we get their real numbers.

## What exists today (keep, build on)

- `src/core/forecast.ts` already chains searches × AI answers per search ×
  mention gap × visits per mention × visit→lead × lead→customer, simulated as
  ranges, and multiplies customers by a customer value for revenue.
  `growthPath` draws the year month by month. `/forecast/method` shows every
  step with its source.
- Free accounts never see it: the overview returns `PreviewSummary` early and
  the Forecast pages render `LockedSection`.

## Why today's numbers can't be shown as they are

1. New audits have no search numbers: buying them is a button in admin.
2. Customer value is one price off the website. Blue Box Bakery got $1,500
   (a wedding cake) when most customers spend about $15.
3. Restaurants, cafés, bakeries and shops are "other", which has no
   benchmarks, so no forecast at all.

## Decisions (Nick)

- Spend a few cents per audit on the real Google search numbers.
- Free accounts see the projection with a summary: added customers, value
  per customer, added revenue. A "how we got this" explanation. A prompt to
  schedule a call so we can learn the business and tighten the numbers.
- It must be accurate to the business model; when we can't be, say less.

## The design

1. **Search numbers bought automatically** at the end of the audit setup,
   right after the forecast setup is drafted, when there is an area and at
   least one search term. A failure (no credit, unknown area) is logged and
   the audit carries on; the forecast then says "not ready".
2. **A new kind of business, `local_shop`**: "Restaurant, café or shop people
   visit". Conversion defaults from published sources (see Benchmarks).
   The drafting prompt is taught it; "other" stays for what fits nothing.
3. **Customer value becomes an estimate with its working.** The drafting AI
   reads every price on the Fact Sheet plus the kind of business and returns:
   spend per visit (low/likely/high), visits in a customer's first year
   (low/likely/high; 1 for a one-off job), billing, a one-sentence basis in
   plain words ("Most orders are pastries and coffee at $8–$20; a few are
   cakes at $60+"), and a confidence (high/low). First-year value =
   spend × visits. The simulation draws value inside its range, so the
   revenue range carries the value's uncertainty too. A value the owner typed
   still wins and is never overwritten.
4. **Dollars only when we can stand behind them.** Revenue is shown only
   when the forecast is ready, the value came from the owner or from prices
   with high confidence. Otherwise the summary shows added customers and says
   "We'll work out what they're worth with you on the call."
5. **Free accounts see it**, on the overview right after the score card, as
   one card:
   - the projection chart (for free accounts only the Recommended-by-AI line,
     since Overall and Accuracy rest on unconfirmed facts; paid accounts keep
     today's chart),
   - a summary row of three figures, each with its range: **Added customers**
     (12 months), **Worth per customer** (first year, with the basis
     sentence), **Added revenue** (12 months),
   - a folded "How we got this number" listing the steps in plain words with
     where each number came from (Google data / our scan / published
     research / your website),
   - the call prompt: "These are estimates from public data and industry
     averages. Schedule a call and we'll put in your real numbers." with the
     Schedule a call button.
   The Forecast page and the method page open for free accounts too (the
   lead/revenue part; accuracy parts stay hidden for them). The "Forecast"
   row leaves the locked list.
6. **Backfill**: re-draft and buy numbers for the recent prospect audits
   (Blue Box, Blue Star) so Nick can test.

## Non-goals

- No change to how scans run or how the mention gap is measured.
- No new pricing or paywall.
- No dollar figure without a value we can explain.

## Constraints

- Plain, short copy. Ranges, never single exact promises. "Roughly".
- Every default needs a named published source (`forecast.ts` rule).
- Schema stays the same: the setup is jsonb; new fields are optional.
- Another session is editing `preview-summary.tsx` and others; this work
  happens in a separate worktree and merges after they commit.

## Benchmarks

Published research for walk-in food and retail businesses is thin (mostly
vendor and agency figures). The ranges below are wide on purpose, each step
names its source, and the method page says plainly that these are the
weakest benchmarks in the model.

- `local_shop` visit → lead ("an order, a call or a direction request"):
  low 1%, likely 3%, high 6%. Sources: SaasHero restaurant site conversion
  (about 1-2% average, top sites 12%,
  https://saashero.net/competitor/restaurant-tech-conversion-optimization/);
  BrightLocal Google Business Profile study (about 5% of views lead to a
  click, call or direction request,
  https://www.brightlocal.com/research/google-my-business-insights-study/).
- `local_shop` lead → customer ("a direction request or call that turns into
  a visit"): low 20%, likely 40%, high 60%. No study measures this directly;
  the nearest is Google's ad click-to-store-visit figures of 6-18%
  (https://econsultancy.com/google-adwords-new-metric-helps-measure-in-store-conversion/),
  which count every click, not only people asking the way. Labeled as our
  assumption on the method page.
- Visits in a new customer's first year: drafted per business by the AI from
  the kind of business, within these guard rails: café, bakery, coffee 2-12
  likely 4; restaurant 1-6 likely 2; shop 1-4 likely 1.5. Source for the low
  repeat rate of first-year customers: Restolabs café data, about 3.2 orders
  per customer (https://www.restolabs.com/blog/cafe-industry-statistics);
  Paytronix full-service loyalty members 7.3 visits a year (an upper bound,
  since loyalty members are the regulars).
- Spend per visit: from the business's own prices, never a benchmark.

Because these are weak, a `local_shop` value always shows its range and the
basis sentence, and the call prompt says we'll replace the averages with
their own numbers.

## Calls made by Claude (Nick can override)

- Free accounts see Recommended-by-AI only on the chart; Overall and Accuracy
  stay locked as before.
- The value estimate is "first year" (not lifetime) to stay conservative.
- `local_shop` gets dollars when the value is high-confidence, despite thin
  benchmarks, with the ranges wide and the sources labeled weak.
- Low-confidence value → customers only, no dollars.
