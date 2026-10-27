import Link from "next/link";
import type { ReactNode } from "react";
import { getDb } from "@/db";
import { Card, Note, buttonClass } from "@/components/ui";
import { ScoreForecastChart, scoreLines } from "@/components/forecast-charts";
import { bookingUrl } from "@/components/locked";
import { loadForecast, type ForecastSetup } from "@/services/forecast";
import { loadAccuracyForecast } from "@/services/accuracy-forecast";
import {
  ORIGIN_LABEL, PACE_MONTHS, growthPath, rangeWords, roughDollars, valueWords, wholeNumber, type Estimate, type NotReady,
} from "@/core/forecast";

const capital = (s: string) => s[0].toUpperCase() + s.slice(1);
/** A dollar range that never reads as "$0". */
const dollarRange = (e: Estimate) => (e.high < 10 ? "under $10" : e.low < 5 ? `up to ${roughDollars(e.high)}` : valueWords(e));

/**
 * A figure as the summary row shows it: the likely value big with its range
 * under it, the range alone when the likely value is too small to say, and no
 * range when there is only one figure.
 */
function shown(e: Estimate, money: boolean): { value: string; range: string | null } {
  const range = money ? dollarRange(e) : rangeWords(e);
  if (money && e.likely < 10) return { value: capital(range), range: null };
  const value = money ? roughDollars(e.likely) : capital(wholeNumber(e.likely));
  return { value, range: range === value || range === value.toLowerCase() ? null : range };
}

/** One of the three figures in the summary row: a big number, its range and what it counts. */
function Figure({ label, estimate, money = false, unit, children }: { label: string; estimate: Estimate; money?: boolean; unit: string; children?: ReactNode }) {
  const { value, range } = shown(estimate, money);
  return (
    <div>
      <p className="text-[14px] font-medium text-ink-soft">{label}</p>
      <p className="mt-1 text-[28px] font-semibold leading-tight tracking-tight tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-[14px] text-muted">{range && <>Range {range} </>}<span className="whitespace-nowrap">{unit}</span></p>
      {children}
    </div>
  );
}

/** Why there is no forecast yet, for a free account and for a paying one. */
const WAITING: Record<NotReady, { free: string; paid: string }> = {
  no_scan: { free: "Your forecast appears once your audit finishes.", paid: "Your forecast appears after your first finished scan." },
  no_demand: {
    free: "We're still collecting how many people search for what you sell. Check back soon.",
    paid: "We're still collecting how many people search for what you sell. Check back soon.",
  },
  no_competitor: {
    free: "AI named no competitor in your audit, so there's no one to compare you with yet.",
    paid: "AI named no competitor in your latest scan, so there's no one to compare you with yet.",
  },
  need_rates: {
    free: "We need a couple of numbers from you to forecast this. We'll get them on the call.",
    paid: "We have no reliable average for your kind of business, so this needs two numbers from you. Add them on the Forecast page.",
  },
};

/**
 * The forecast in one card for the Overview page: where the scores are
 * heading, as the chart the Forecast page shows, then the year's added
 * customers, what each is worth and the added revenue, with the working
 * folded underneath. Dollars appear only when the customer value is one we
 * can stand behind. A free account (`free`) sees only the Recommended-by-AI
 * line, since Overall and Accuracy rest on facts not yet confirmed, and the
 * prompt to schedule a call. Shows nothing when there is nothing to show yet.
 */
export async function ForecastCard({ slug, practice, free = false }: {
  slug: string;
  practice: { id: string; website: string | null; forecast: ForecastSetup | null };
  free?: boolean;
}) {
  const db = getDb();
  const [{ setup, result }, accuracy] = await Promise.all([loadForecast(db, practice), loadAccuracyForecast(db, practice)]);
  const forecast = result.ready ? result.forecast : null;
  const year = forecast && !forecast.ahead ? growthPath(forecast, setup).at(-1)! : null;
  const lines = scoreLines(accuracy.history, accuracy.scores).filter(line => !free || line.key === "visibility");
  if (lines.length === 0 && !forecast) return null;

  // The headline names the score that sums the chart up: Overall, or whichever is on the chart.
  const pick = lines.find(l => l.key === "overall") ?? lines.find(l => l.key === "visibility") ?? lines[0];
  const score = pick ? accuracy.scores[pick.key as keyof typeof accuracy.scores] : null;
  const monthly = setup.billing === "monthly";
  // An online store counts orders, each worth one order, so revenue is not counted twice.
  const store = setup.businessType === "ecommerce";
  const money = forecast?.revenueTrusted && forecast.value && year?.revenue ? { value: forecast.value, revenue: year.revenue } : null;
  // No dollar figure we cannot stand behind, in the working either.
  const steps = forecast ? forecast.steps.filter(step => money || !step.value.includes("$")) : [];

  return (
    <Card
      title="Your forecast"
      aside={<Link href={`/dashboard/${slug}/forecast`} className="text-[14px] font-medium text-ink-soft underline hover:text-gold">Open the forecast</Link>}
    >
      {pick && score && (
        <p className="text-[17px] text-ink-soft">
          {pick.label} <span className="font-semibold text-ink">{score.now}</span> today, about <span className={`font-semibold ${pick.text}`}>{score.points.at(-1)!.likely}</span> in {score.points.at(-1)!.month} months
        </p>
      )}
      {lines.length > 0 && (
        <div className="mt-3">
          <ScoreForecastChart compact lines={lines} pastLabels={accuracy.history.map(() => "")} />
        </div>
      )}

      {year && (
        <div className="mt-5 grid grid-cols-1 gap-5 border-t border-line pt-5 sm:grid-cols-3">
          <Figure label={store ? "Added orders" : "Added customers"} estimate={year.customers} unit={`in ${PACE_MONTHS} months`} />
          {money ? (
            <>
              <Figure label={store ? "Worth per order" : "Worth per customer"} estimate={money.value} money
                unit={monthly ? "a month" : store ? "an order" : "first year"}>
                {setup.valueEstimate && setup.valueFrom === "prices" && (
                  <p className="mt-2 text-[13px] leading-snug text-muted">{setup.valueEstimate.basis}</p>
                )}
              </Figure>
              <Figure label="Added revenue" estimate={money.revenue} money
                unit={monthly ? "a month, a year from now" : `in ${PACE_MONTHS} months`} />
            </>
          ) : (
            <p className="self-center text-[15px] leading-relaxed text-ink-soft sm:col-span-2">
              {free
                ? "We'll work out what a customer is worth to you on the call."
                : "Add what a customer is worth to you on the Forecast page to see the revenue."}
            </p>
          )}
        </div>
      )}
      {forecast?.ahead && (
        <Note className="mt-4">AI already names you as often as {forecast.competitor}, so there is no gap to add customers from. The work now is keeping it that way.</Note>
      )}
      {!result.ready && (
        <Note className="mt-4">{WAITING[result.reason][free ? "free" : "paid"]}</Note>
      )}

      {forecast && (
        <details className="mt-5 border-t border-line pt-4">
          <summary className="cursor-pointer text-[15px] font-semibold text-ink">How we got this number</summary>
          <ol className="mt-3 divide-y divide-line">
            {steps.map(step => (
              <li key={step.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 text-[14px]">
                <span className="text-ink">{step.label}</span>
                <span className="text-ink-soft"><span className="font-semibold tabular-nums text-ink">{step.value}</span> · {ORIGIN_LABEL[step.origin]}</span>
              </li>
            ))}
          </ol>
          <Link href={`/dashboard/${slug}/forecast/method`} className="mt-3 inline-block text-[14px] font-medium text-ink-soft underline hover:text-gold">
            See the full working
          </Link>
        </details>
      )}

      {free && (
        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px] leading-relaxed text-ink-soft">
            These are estimates from public data and industry averages. Schedule a call and we&apos;ll put in your real numbers.
          </p>
          <a href={bookingUrl()} className={`${buttonClass("gold")} shrink-0 self-start sm:self-auto`}>Schedule a call</a>
        </div>
      )}
    </Card>
  );
}
