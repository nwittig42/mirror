import Link from "next/link";
import { requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, Note, PageBody, buttonClass } from "@/components/ui";
import { GrowthTile, ScoreForecastChart, scoreLines } from "@/components/forecast-charts";
import { fieldClass } from "@/app/admin/ui";
import { loadForecast } from "@/services/forecast";
import { loadAccuracyForecast } from "@/services/accuracy-forecast";
import { FIX_SOURCE_LABEL } from "@/core/accuracy-forecast";
import {
  BUSINESS_TYPE_LABEL, ON_THE_CALL, PACE_MONTHS, RATE_DEFAULTS, growthPath, leadNoun, rangeWords, roughDollars, wholeNumber,
  type Estimate, type NotReady,
} from "@/core/forecast";
import { getChecksForScan, getLatestScan } from "@/lib/queries";
import { changeWords, shareForecast } from "@/core/share-forecast";
import { ShareChart } from "@/components/share-chart";
import { saveOwnNumbers } from "./actions";

/** A before-and-after figure: today, then where the next steps take it. */
function Stat({ label, from, to }: { label: string; from: string; to: string }) {
  return (
    <div className="rounded-[14px] border border-line p-4">
      <p className="text-[13px] font-medium text-ink-soft">{label}</p>
      <p className="mt-1.5 text-[26px] font-semibold leading-tight tracking-tight tabular-nums">
        <span className="text-muted">{from}</span>
        <span className="mx-2 text-[20px] text-muted" aria-hidden="true">→</span>
        <span className="sr-only"> to </span>
        <span className="text-gold">{to}</span>
      </p>
    </div>
  );
}

const WAITING: Record<Exclude<NotReady, "need_rates">, string> = {
  no_demand: "Not ready yet. We are still collecting how many people search for what you sell, which this is built on. Nothing is needed from you.",
  no_scan: "Not ready yet. It needs a finished scan, and appears here after your next one.",
  no_competitor: "AI named no competitor in your latest scan, so there is no one to compare you with yet.",
};

const percent = (rate: number | null) => (rate === null ? "" : String(+(rate * 100).toFixed(2)));
const dollarRange = (e: Estimate) => (e.high < 10 ? "under $10" : `${roughDollars(e.low)} to ${roughDollars(e.high)}`);
const plural = (n: number, word: string) => (Math.round(n) === 1 ? word : `${word}s`);

/**
 * The customer's forecast: the year ahead in visits, leads, customers and
 * revenue if they follow their Next steps and win back about three quarters of the answers that name a competitor instead (at least matching the competitor AI names most),
 * and where their Accuracy score goes as wrong facts are fixed. Every figure
 * is a likely value with a range beside it and its condition above it, never
 * a promise. A prospect before their call (`locked`) sees the leads and
 * revenue, and the Recommended-by-AI line on the chart, but nothing that rests
 * on facts not yet confirmed (Overall, Accuracy) and not the form for their
 * own numbers, which waits for the call.
 */
export default async function ForecastPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { practice, locked } = await requirePracticeView(slug);

  const db = getDb();
  const [{ setup, result }, accuracy] = await Promise.all([loadForecast(db, practice), loadAccuracyForecast(db, practice)]);
  const forecast = result.ready ? result.forecast : null;
  const defaults = setup.businessType === "other" ? null : RATE_DEFAULTS[setup.businessType];
  const store = setup.businessType === "ecommerce";
  const noun = leadNoun(setup.businessType);
  const method = <Link href={`/dashboard/${slug}/forecast/method`} className={buttonClass("outline")}>How we got this</Link>;

  // The year, month by month, and where it ends.
  const path = forecast && !forecast.ahead ? growthPath(forecast, setup) : null;
  const year = path?.[path.length - 1];
  // Revenue only from a customer value we can stand behind.
  const revenue = forecast?.revenueTrusted ? year?.revenue ?? null : null;
  const adYear = forecast?.adCost && year && forecast.visits.likely > 0
    ? { low: forecast.adCost.low * (year.visits.low / forecast.visits.low || 0), likely: forecast.adCost.likely * (year.visits.likely / forecast.visits.likely), high: forecast.adCost.high * (year.visits.high / forecast.visits.high || 0) }
    : null;
  // Customers (or orders) only once there is at least one to count.
  const counted = !!year && (store ? year.leads.likely >= 1 : year.customers.likely >= 1);
  const growthColour = { stroke: "stroke-ring-visibility", fill: "fill-ring-visibility" };

  // Before the call, nothing that rests on unconfirmed facts: no Accuracy forecast, no Overall.
  const acc = locked ? null : accuracy.forecast;
  const final = acc?.points[acc.points.length - 1];
  const lines = scoreLines(accuracy.history, accuracy.scores).filter(line => !locked || line.key === "visibility");
  const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  // The headline: how often AI recommends them, measured today, and where the next steps take it.
  const scan = await getLatestScan(db, practice.id);
  const share = shareForecast(scan ? await getChecksForScan(db, scan.id) : []);
  const change = share ? changeWords(share.now, share.then.likely) : null;
  const leader = share?.competitors[0] ?? null;
  const round = (n: number) => Math.max(0, Math.round(n));
  const recs = forecast && forecast.recommendations.added.likely >= 1
    ? { today: round(forecast.recommendations.today), then: round(forecast.recommendations.today + forecast.recommendations.added.likely) }
    : null;

  return (
    <PageBody>
      <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="forecast" />

      <div className="space-y-4">
        <Card title="The year ahead">
          {share && share.then.likely > share.now && (
            <>
              {/* What an owner reads first, and it's measured: the share of buyer answers that recommend them. */}
              <p className="text-[26px] font-semibold leading-snug tracking-tight text-ink sm:text-[32px]">
                AI recommends you in {share.now}% of answers today. Following your next steps:{" "}
                <span className="text-gold">about {share.then.likely}%</span> in {PACE_MONTHS} months{change ? `, ${change}` : ""}.
              </p>
              {leader && (
                <p className="mt-2 text-[17px] leading-relaxed text-ink-soft">
                  {share.rankThen === 1
                    ? <>That would make you the business AI recommends most, ahead of <span className="font-semibold text-ink">{leader.name}</span> ({leader.share}%).</>
                    : share.rankThen < share.rankNow
                      ? <>That would move you from #{share.rankNow} to #{share.rankThen} of everyone AI recommends. <span className="font-semibold text-ink">{leader.name}</span> leads today with {leader.share}%.</>
                      : <>That would close in on <span className="font-semibold text-ink">{leader.name}</span>, who leads today with {leader.share}%.</>}
                </p>
              )}
              <ShareChart now={share.now} then={share.then} rival={leader} />
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Stat label="Share of AI answers that recommend you" from={`${share.now}%`} to={`${share.then.likely}%`} />
                <Stat label="Your place among businesses AI names" from={`#${share.rankNow}`} to={`#${share.rankThen}`} />
                {recs && <Stat label="AI recommendations a month (estimated)" from={String(recs.today)} to={String(recs.then)} />}
              </div>
              <Note className="mt-4">
                Today&apos;s {share.now}% is measured from {share.answers} AI answers in your latest scan. The forecast assumes your next steps win back about three quarters of the answers that name a competitor instead of you, at a steady pace, and that competitors stay where they are.
              </Note>
            </>
          )}
          {forecast && path && year && !counted && (
            <Note className="mt-4 border-t border-line pt-4">
              {`Too early to count in customers: at about ${forecast.monthlySearches.toLocaleString("en-US")} searches a month for what you sell, the averages we use round to less than one. We'll count real calls and orders with you once your plan is running.`}
            </Note>
          )}
          {forecast && path && year && counted && (
            <div className={share ? "mt-6 border-t border-line pt-5" : ""}>
              <p className="text-[15px] text-ink-soft">
                What that could bring in over the next {PACE_MONTHS} months
              </p>
              <p className="mt-1 text-[24px] font-semibold leading-tight tracking-tight text-ink">
                {store
                    ? `About ${wholeNumber(year.leads.likely)} more ${plural(year.leads.likely, "order")} in the next ${PACE_MONTHS} months`
                    : `About ${wholeNumber(year.leads.likely)} more ${plural(year.leads.likely, noun)} and ${wholeNumber(year.customers.likely)} more ${plural(year.customers.likely, "customer")} in the next ${PACE_MONTHS} months`}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <GrowthTile label="Visits from AI" value={wholeNumber(year.visits.likely)} range={`Range ${rangeWords(year.visits)}`} points={path.map(p => p.visits)} {...growthColour} />
                <GrowthTile label={`${noun[0].toUpperCase()}${noun.slice(1)}s`} value={wholeNumber(year.leads.likely)} range={`Range ${rangeWords(year.leads)}`} points={path.map(p => p.leads)} {...growthColour} />
                {!store && <GrowthTile label="New customers" value={wholeNumber(year.customers.likely)} range={`Range ${rangeWords(year.customers)}`} points={path.map(p => p.customers)} {...growthColour} />}
                {revenue ? (
                  <GrowthTile
                    label={setup.billing === "monthly" ? `Monthly revenue by month ${PACE_MONTHS}` : "Revenue"}
                    value={revenue.likely < 10 ? `${dollarRange(revenue)[0].toUpperCase()}${dollarRange(revenue).slice(1)}` : roughDollars(revenue.likely)}
                    range={revenue.likely < 10 ? "" : `Range ${dollarRange(revenue)}`}
                    points={path.map(p => p.revenue!)} {...growthColour} />
                ) : adYear && !locked && (
                  <GrowthTile label="Worth as Google ads" value={roughDollars(adYear.likely)} range={`Range ${dollarRange(adYear)}`}
                    points={path.map(p => ({ low: p.visits.low, likely: p.visits.likely, high: p.visits.high }))} {...growthColour} />
                )}
              </div>
              <Note className="mt-4">
                Totals for the next {PACE_MONTHS} months{revenue && setup.billing === "monthly" ? ", except monthly revenue, which is what the customers gained would be paying each month by then" : ""}.
                An estimate from {forecast.monthlySearches.toLocaleString("en-US")} searches a month, your latest scan and industry averages. It is not a promise of what you will get, or of what our work will deliver.
              </Note>
            </div>
          )}
          {forecast?.ahead && (
            <>
              <p className="text-[22px] font-semibold tracking-tight text-ink">AI already names you as often as {forecast.competitor}.</p>
              <Note className="mt-2">
                This forecast measures the gap between you and the competitor AI names most. There is no gap today, so there is nothing to add. The work now is keeping it that way.
              </Note>
            </>
          )}
          {!result.ready && (
            <Note>
              {result.reason === "need_rates" && locked
                ? `We have no reliable average for your kind of business. ${ON_THE_CALL}`
                : result.reason === "need_rates"
                ? "We have no reliable average for your kind of business, so this needs two numbers from you: how many website visits become a lead, and how many leads become a customer. Add them below."
                : WAITING[result.reason]}
            </Note>
          )}
          {forecast && <div className="mt-4">{method}</div>}
        </Card>

        <Card title="Your score">
          {lines.length > 0 ? (
            <>
              <p className="text-[15px] text-ink-soft">
                {[
                  acc && "every wrong fact is corrected at its source this week",
                  accuracy.competitor && "you follow your next steps and win back about three quarters of the answers AI gives a competitor over the year",
                ].filter(Boolean).map((part, i) => (i === 0 ? `If ${part}` : `and ${part}`)).join(", ") || "Nothing is set to change your scores right now"}
              </p>
              {!locked && accuracy.scores.overall && (
                <p className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-ink">
                  Overall {accuracy.scores.overall.now} today, about <span className="text-ring-overall">{accuracy.scores.overall.points.at(-1)!.likely}</span> in 12 months
                </p>
              )}
              <div className="mt-4">
                <ScoreForecastChart lines={lines} pastLabels={accuracy.history.map(h => shortDate(h.date))} />
              </div>
              <Note className="mt-3">
                Today&apos;s score, then where it could be in 12 months. Solid lines are your scans; dotted lines are the forecast, with its range shaded.
              </Note>
              {acc && final && (
                <>
                  <p className="mt-5 text-[15px] font-semibold text-ink">
                    Accuracy: {acc.now} today, about <span className="text-ring-facts">{acc.points[0].likely}</span> in {acc.points[0].month} months and <span className="text-ring-facts">{final.likely}</span> in {final.month}
                    <span className="font-normal text-ink-soft"> (range {final.low} to {final.high}; {acc.best} with every wrong fact gone)</span>
                  </p>
                  <ul className="mt-2 divide-y divide-line border-t border-line">
                    {acc.bySource.map(row => (
                      <li key={row.source} className="flex items-baseline justify-between gap-4 py-2.5 text-[15px]">
                        <span className="text-ink">{FIX_SOURCE_LABEL[row.source]} <span className="text-muted">· {row.count} wrong {plural(row.count, "fact")}</span></span>
                        <span className="shrink-0 font-semibold tabular-nums text-ring-facts">{row.points} points</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {acc && <Link href={`/dashboard/${slug}/fixes#wrong-facts`} className={buttonClass("gold")}>See the wrong facts</Link>}
                {!forecast && method}
              </div>
            </>
          ) : (
            <Note>Your score forecast appears after your first finished scan.</Note>
          )}
        </Card>

        {!locked && (
        <details className="group rounded-[20px] border border-line bg-paper p-5" open={!result.ready && result.reason === "need_rates"}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-ink">
            Make it more accurate with your real numbers
            <span className="text-[17px] transition-transform group-open:rotate-90" aria-hidden="true">→</span>
          </summary>
          <Note className="mt-3">
            The forecast assumes typical rates{defaults ? ` for ${BUSINESS_TYPE_LABEL[setup.businessType].toLowerCase()}` : ""}: how many website visitors
            get in touch, how many of those become customers, and what a customer pays. If you know yours, type them here and the
            forecast uses them. Leave a box empty to keep the typical rate.
          </Note>
          <form action={saveOwnNumbers.bind(null, slug)} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-[14px] font-medium text-ink">
              Website visits that become {store ? "an order" : `a ${noun}`} (%)
              <input name="visitToLead" inputMode="decimal" defaultValue={percent(setup.visitToLead)}
                placeholder={defaults ? `Average: ${+(defaults.visitToLead.range.likely * 100).toFixed(1)}` : "e.g. 4"} className={`${fieldClass} mt-1.5 w-full`} />
            </label>
            {!store && (
              <label className="block text-[14px] font-medium text-ink">
                {noun === "sign-up" ? "Sign-ups that become paying customers (%)" : "Leads that become a customer (%)"}
                <input name="leadToCustomer" inputMode="decimal" defaultValue={percent(setup.leadToCustomer)}
                  placeholder={defaults ? `Average: ${+(defaults.leadToCustomer.range.likely * 100).toFixed(1)}` : "e.g. 25"} className={`${fieldClass} mt-1.5 w-full`} />
              </label>
            )}
            <label className="block text-[14px] font-medium text-ink">
              What a new customer pays ($)
              <input name="customerValue" inputMode="decimal" defaultValue={setup.customerValue ?? ""} placeholder="e.g. 450" className={`${fieldClass} mt-1.5 w-full`} />
              {setup.valueFrom === "prices" && <span className="mt-1 block text-[13px] font-normal text-muted">Read from the prices on your Fact Sheet. Change it if a typical customer pays something else.</span>}
            </label>
            <label className="block text-[14px] font-medium text-ink">
              How they pay
              <select name="billing" defaultValue={setup.billing} className={`${fieldClass} mt-1.5 w-full`}>
                <option value="once">That much in their first year</option>
                <option value="monthly">That much every month</option>
              </select>
            </label>
            <div className="sm:col-span-2"><button type="submit" className={buttonClass("primary")}>Update forecast</button></div>
          </form>
        </details>
        )}
      </div>
    </PageBody>
  );
}
