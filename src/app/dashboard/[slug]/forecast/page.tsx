import Link from "next/link";
import { requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import { DashboardHeader } from "@/components/dashboard-header";
import { LockedSection } from "@/components/locked";
import { Card, Note, PageBody, buttonClass } from "@/components/ui";
import { GrowthTile, ScoreForecastChart, scoreLines } from "@/components/forecast-charts";
import { fieldClass } from "@/app/admin/ui";
import { loadForecast } from "@/services/forecast";
import { loadAccuracyForecast } from "@/services/accuracy-forecast";
import { FIX_SOURCE_LABEL } from "@/core/accuracy-forecast";
import {
  BUSINESS_TYPE_LABEL, PACE_MONTHS, RATE_DEFAULTS, growthPath, leadNoun, rangeWords, roughDollars, wholeNumber,
  type Estimate, type NotReady,
} from "@/core/forecast";
import { saveOwnNumbers } from "./actions";

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
 * revenue if AI came to name them as often as the competitor it names most,
 * and where their Accuracy score goes as wrong facts are fixed. Every figure
 * is a likely value with a range beside it and its condition above it, never
 * a promise. A prospect before their call gets the locked card and no data.
 */
export default async function ForecastPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { practice, locked } = await requirePracticeView(slug);
  if (locked) {
    return (
      <PageBody>
        <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="forecast" />
        <LockedSection
          title="Forecast"
          what="A rough estimate of how many more leads and customers you could get if AI named you as often as your top competitor, with every step of the working shown."
        />
      </PageBody>
    );
  }

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
  const adYear = forecast?.adCost && year && forecast.visits.likely > 0
    ? { low: forecast.adCost.low * (year.visits.low / forecast.visits.low || 0), likely: forecast.adCost.likely * (year.visits.likely / forecast.visits.likely), high: forecast.adCost.high * (year.visits.high / forecast.visits.high || 0) }
    : null;
  const growthColour = { stroke: "stroke-ring-visibility", fill: "fill-ring-visibility" };

  const acc = accuracy.forecast;
  const final = acc?.points[acc.points.length - 1];
  const lines = scoreLines(accuracy.history, accuracy.scores);
  const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <PageBody>
      <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="forecast" />

      <div className="space-y-4">
        <Card title="The year ahead">
          {forecast && path && year && (
            <>
              <p className="text-[15px] text-ink-soft">
                If AI came to name you as often as it names {forecast.competitor}, at a steady pace over {PACE_MONTHS} months
              </p>
              <p className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-ink">
                {year.leads.likely < 0.5
                  ? `Fewer than 1 more ${noun} in the next ${PACE_MONTHS} months`
                  : store
                    ? `About ${wholeNumber(year.leads.likely)} more ${plural(year.leads.likely, "order")} in the next ${PACE_MONTHS} months`
                    : `About ${wholeNumber(year.leads.likely)} more ${plural(year.leads.likely, noun)} and ${wholeNumber(year.customers.likely)} more ${plural(year.customers.likely, "customer")} in the next ${PACE_MONTHS} months`}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <GrowthTile label="Visits from AI" value={wholeNumber(year.visits.likely)} range={`Range ${rangeWords(year.visits)}`} points={path.map(p => p.visits)} {...growthColour} />
                <GrowthTile label={`${noun[0].toUpperCase()}${noun.slice(1)}s`} value={wholeNumber(year.leads.likely)} range={`Range ${rangeWords(year.leads)}`} points={path.map(p => p.leads)} {...growthColour} />
                {!store && <GrowthTile label="New customers" value={wholeNumber(year.customers.likely)} range={`Range ${rangeWords(year.customers)}`} points={path.map(p => p.customers)} {...growthColour} />}
                {year.revenue ? (
                  <GrowthTile
                    label={setup.billing === "monthly" ? `Monthly revenue by month ${PACE_MONTHS}` : "Revenue"}
                    value={year.revenue.likely < 10 ? "Under $10" : roughDollars(year.revenue.likely)}
                    range={`Range ${dollarRange(year.revenue)}`}
                    points={path.map(p => p.revenue!)} {...growthColour} />
                ) : adYear && (
                  <GrowthTile label="Worth as Google ads" value={roughDollars(adYear.likely)} range={`Range ${dollarRange(adYear)}`}
                    points={path.map(p => ({ low: p.visits.low, likely: p.visits.likely, high: p.visits.high }))} {...growthColour} />
                )}
              </div>
              <Note className="mt-4">
                Totals for the next {PACE_MONTHS} months{year.revenue && setup.billing === "monthly" ? ", except monthly revenue, which is what the customers gained would be paying each month by then" : ""}.
                An estimate from {forecast.monthlySearches.toLocaleString("en-US")} searches a month, your latest scan and industry averages. It is not a promise of what you will get, or of what our work will deliver.
              </Note>
            </>
          )}
          {forecast?.ahead && (
            <>
              <p className="text-[22px] font-semibold tracking-tight text-ink">AI already names you as often as {forecast.competitor}.</p>
              <Note className="mt-2">
                This forecast measures the gap between you and the competitor AI names most. There is no gap today, so there is nothing to add. Holding that position is the job now.
              </Note>
            </>
          )}
          {!result.ready && (
            <Note>
              {result.reason === "need_rates"
                ? "We have no reliable average for your kind of business, so this needs two numbers from you: how many website visits become a lead, and how many leads become a customer. Add them below."
                : WAITING[result.reason]}
            </Note>
          )}
          {forecast && <div className="mt-4">{method}</div>}
        </Card>

        <Card title="GEO forecast">
          {lines.length > 0 ? (
            <>
              <p className="text-[15px] text-ink-soft">
                {[
                  acc && "every wrong fact is corrected at its source this week",
                  accuracy.competitor && "AI comes to name you as often as " + accuracy.competitor + " over the year",
                ].filter(Boolean).map((part, i) => (i === 0 ? `If ${part}` : `and ${part}`)).join(", ") || "Nothing is set to change your scores right now"}
              </p>
              {accuracy.scores.overall && (
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

        <details className="group rounded-[20px] border border-line bg-paper p-5" open={!result.ready && result.reason === "need_rates"}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
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
      </div>
    </PageBody>
  );
}
