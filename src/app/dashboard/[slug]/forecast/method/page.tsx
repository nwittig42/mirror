import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import { forecastSnapshots } from "@/db/schema";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, Note, PageBody, Table, Tag, buttonClass, type Tone } from "@/components/ui";
import { areaWords, loadForecast } from "@/services/forecast";
import { loadAccuracyForecast } from "@/services/accuracy-forecast";
import { FIXED_BY, FIX_SOURCES, FIX_SOURCE_LABEL, FORECAST_MONTHS, type FixSource } from "@/core/accuracy-forecast";
import { FACT_PENALTY, SHOWN_CAP, SHOWN_FLOOR, shownPoints } from "@/core/scoring";
import { PACE_RANGE_MONTHS } from "@/core/score-forecast";
import {
  BENCHMARKS_AS_OF, CHURN_SOURCES, FORECAST_MODEL_VERSION, MONTHLY_CHURN, ORIGIN_LABEL, PACE_MONTHS, PACE_SOURCES,
  noteForFree, rangeWords, wholeNumber, type Origin,
} from "@/core/forecast";

const ORIGIN_TONE: Record<Origin, Tone> = { measured: "ok", bought: "neutral", yours: "gold", prices: "gold", assumption: "neutral" };

const NOT_COUNTED = [
  "Phone calls, map taps and bookings made straight from an AI answer, with no website visit. No one has measured these.",
  "Google's AI Overviews, the AI box above ordinary search results. We read them in your scans and will add them here.",
  "Growth in AI use. The forecast uses today's level only.",
  "Repeat business and referrals from the new customers.",
  "The effect of wrong facts. AI naming you with the wrong price or hours is worth less than naming you correctly, but no research says by how much.",
  "Where in the answer you are named. First of five and last of five count the same here.",
];

const day = (d: Date | string) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/**
 * How the forecast was worked out: every step with the value used, where it
 * came from and its source, the searches counted, what is left out, and how
 * the forecast will be checked. A prospect before their call (`locked`) sees
 * the leads and revenue working, but not the Accuracy forecast or Overall,
 * which rest on facts not yet confirmed.
 */
export default async function ForecastMethodPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { practice, locked } = await requirePracticeView(slug);
  const header = <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="forecast" />;
  const db = getDb();
  const [{ setup, result, scanDate }, accuracy, [kept]] = await Promise.all([
    loadForecast(db, practice),
    loadAccuracyForecast(db, practice),
    db.select({ n: count() }).from(forecastSnapshots).where(eq(forecastSnapshots.practiceId, practice.id)),
  ]);
  const back = <Link href={`/dashboard/${slug}/forecast`} className={buttonClass("outline")}>Back to the forecast</Link>;
  const forecast = result.ready ? result.forecast : null;
  const acc = locked ? null : accuracy.forecast;
  if (!forecast && !acc) {
    return (
      <PageBody>
        {header}
        <Card title="How we got this number">
          <Note>There is no forecast to explain yet.</Note>
          <div className="mt-4">{back}</div>
        </Card>
      </PageBody>
    );
  }
  const counted = setup.keywords.filter(k => (k.searches ?? 0) > 0).sort((a, b) => (b.searches ?? 0) - (a.searches ?? 0));
  const left = setup.keywords.length - counted.length;
  // Dollars only from a customer value we can stand behind.
  const trusted = !!forecast?.revenueTrusted;
  const steps = forecast ? forecast.steps.filter(step => trusted || !step.value.includes("$")) : [];

  return (
    <PageBody>
      {header}

      <div className="space-y-4">
        {forecast && (<>
        <Card title="How we got this number">
          <p className="text-[17px] leading-relaxed text-ink">
            About {wholeNumber(forecast.leads.likely)} more lead{Math.round(forecast.leads.likely) === 1 ? "" : "s"} in a full year ({rangeWords(forecast.leads)}), once your next steps win back about half the answers that name a competitor instead of you.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            We start from how many people search for what you sell in your area, work out how many of those questions go to AI, take the gap
            between how often AI names you and how often it names {forecast.competitor}, and follow those extra mentions through to visits,
            leads and customers. It is an estimate of an opportunity, not a promise or a guarantee.
          </p>
          <div className="mt-4">{back}</div>
        </Card>

        <Card title="The working">
          <ol className="divide-y divide-line">
            {steps.map((step, i) => (
              <li key={step.label} className="grid grid-cols-1 gap-x-6 gap-y-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-[15px] font-semibold text-ink">{i + 1}. {step.label}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{locked ? noteForFree(step.note) : step.note}</p>
                  {step.sources.length > 0 && (
                    <p className="mt-1 text-[13px] text-muted">
                      Source: {step.sources.map((s, n) => (
                        <span key={s.url}>{n > 0 && ", "}<a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-gold">{s.name}</a></span>
                      ))}
                    </p>
                  )}
                </div>
                <div className="sm:text-right">
                  <p className="text-[17px] font-semibold tabular-nums text-ink">{step.value}</p>
                  <div className="mt-1"><Tag tone={ORIGIN_TONE[step.origin]}>{ORIGIN_LABEL[step.origin]}</Tag></div>
                </div>
              </li>
            ))}
          </ol>
          <Note className="mt-4">Where a step shows three numbers, they are low / likely / high.</Note>
        </Card>

        <Card title="The searches we counted">
          <Note>
            Google&apos;s monthly count for each search in {setup.area ? areaWords(setup.area) : "your area"}
            {setup.demandAt ? `, bought on ${day(setup.demandAt)}` : ""}. {forecast.monthlySearches.toLocaleString("en-US")} a month in all.
            {left > 0 ? ` ${left} search${left === 1 ? "" : "es"} Google has no number for ${left === 1 ? "is" : "are"} left out.` : ""}
          </Note>
          <div className="mt-4">
            <Table
              head={["Search", "A month", "Price of a click"]}
              right={[1, 2]}
              rows={counted.map(k => [k.keyword, (k.searches ?? 0).toLocaleString("en-US"), k.cpc === null ? "No price" : `$${k.cpc.toFixed(2)}`])}
            />
          </div>
        </Card>

        <Card title="The year ahead">
          <p className="text-[15px] leading-relaxed text-ink-soft">
            The working above gives a full year with the gap to {forecast.competitor} already closed. It will not close overnight, so the
            Forecast page draws it closing at a steady pace over {PACE_MONTHS} months: one twelfth of the way after a month, half way after
            six. Added up, the first {PACE_MONTHS} months come to a little over half of a full year&apos;s worth.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            <span className="font-semibold text-ink">The pace is our assumption, not a measurement.</span> Nobody has published how long it
            takes to close a gap with a competitor in AI answers. Agencies report a first rise after 45 to 75 days, and which sites AI
            cites changes by 40 to 60% from month to month, so movement is possible within a year. How much is what your weekly scans will show.
          </p>
          {trusted && setup.customerValue !== null && (
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              <span className="font-semibold text-ink">Revenue.</span>{" "}
              {setup.billing === "monthly"
                ? `Each new customer is counted at $${setup.customerValue.toLocaleString("en-US")} a month for as long as they stay. We assume ${Math.round(MONTHLY_CHURN.likely * 100)}% of subscribers cancel each month (${Math.round(MONTHLY_CHURN.low * 100)} to ${Math.round(MONTHLY_CHURN.high * 100)}%): published figures run from about 2% a month for expensive business software to about 10% for consumer apps.`
                : `Each new customer is counted once, at $${setup.customerValue.toLocaleString("en-US")} for their first year. Repeat business after that is left out.`}
            </p>
          )}
          <p className="mt-3 text-[13px] text-muted">
            Sources: {[...PACE_SOURCES, ...(trusted && setup.customerValue !== null && setup.billing === "monthly" ? CHURN_SOURCES : [])].map((s, n) => (
              <span key={s.url}>{n > 0 && ", "}<a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-gold">{s.name}</a></span>
            ))}
          </p>
        </Card>

        <Card title="How the range is worked out">
          <p className="text-[15px] leading-relaxed text-ink-soft">
            Several steps are uncertain, so each has a low, a likely and a high value. The likely figure is every step at its likely value,
            so the working above multiplies out to it, times 12 months. For the range we run the sums 10,000 times, each time picking every
            uncertain number from inside its range, and keep the middle 8 in 10 results.
            Multiplying all the lows together and all the highs together would give a far wider range than is realistic, because every step
            being at its worst at once is very unlikely.
          </p>
          <p className="mt-4 text-[15px] font-semibold text-ink">What moves the number most</p>
          <ul className="mt-2 space-y-1.5 text-[15px] text-ink-soft">
            {forecast.movers.map(m => <li key={m.label}>{m.label}: the high end is {m.times} times the low end.</li>)}
          </ul>
        </Card>

        <Card title="What is not counted">
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft">
            {NOT_COUNTED.map(line => <li key={line}>{line}</li>)}
          </ul>
        </Card>

        </>)}

        {acc && (
          <Card title="The Accuracy forecast">
            <p className="text-[15px] leading-relaxed text-ink-soft">
              Accuracy starts at 100 and loses points for every wrong fact AI stated in your latest scan: about {shownPoints(FACT_PENALTY.critical)} points for a
              serious one, about {shownPoints(FACT_PENALTY.major)} for an important one, about {shownPoints(FACT_PENALTY.minor)} for a minor one, and half as much again when it
              is a price. It never goes below {SHOWN_FLOOR}, where every business starts. That part is worked out, not estimated. When AI stops saying a wrong fact, its points come back.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              What we estimate is how long that takes once the source is corrected, and it depends on where AI read the mistake. The forecast
              gives each wrong fact&apos;s points back in proportion to the chance it is gone by then. It assumes the fix is made in the first week.
            </p>
            <div className="mt-4">
              <Table
                head={["Where AI read it", "Gone by 3 months", "6 months", "9 months", "12 months"]}
                right={[1, 2, 3, 4]}
                rows={(Object.keys(FIXED_BY) as FixSource[]).map(source => [
                  FIX_SOURCE_LABEL[source],
                  ...FORECAST_MONTHS.map(month => `${Math.round(FIXED_BY[source][month].likely * 100)}% (${Math.round(FIXED_BY[source][month].low * 100)} to ${Math.round(FIXED_BY[source][month].high * 100)})`),
                ])}
              />
            </div>
            <Note className="mt-4">
              These chances are our estimates, labelled as such: nobody has published a measured rate for how fast AI tools drop a corrected
              fact. They lean on small experiments where AI picked up a changed page in one day to three weeks, on one test where two AI tools
              kept repeating other sites&apos; claims in over a third of answers after an official correction, and on the fact that an AI
              model&apos;s training ends months before its release, which is why mistakes with no source take longest. The further out, the wider
              the range. Your own weekly scans replace these estimates as they come in.
            </Note>
            <p className="mt-2 text-[13px] text-muted">
              Sources: {FIX_SOURCES.map((s, n) => (
                <span key={s.url}>{n > 0 && ", "}<a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-gold">{s.name}</a></span>
              ))}
            </p>
            <p className="mt-5 text-[15px] font-semibold text-ink">Your wrong facts and what each costs</p>
            <div className="mt-2">
              <Table
                head={["Wrong fact", "Where AI read it", "Points"]}
                right={[2]}
                rows={acc.facts.map(f => [f.label, FIX_SOURCE_LABEL[f.source], String(f.points)])}
              />
            </div>
            {!forecast && <div className="mt-4">{back}</div>}
          </Card>
        )}

        <Card title={locked ? "The line on the chart" : "The three lines on the chart"}>
          <ul className="space-y-3 text-[15px] leading-relaxed text-ink-soft">
            {!locked && <li><span className="font-semibold text-ink">Accuracy</span> rises as wrong facts are fixed, as worked out above.</li>}
            <li>
              <span className="font-semibold text-ink">Recommended by AI</span> is drawn rising from your score toward the score
              {accuracy.competitor ? ` ${accuracy.competitor} gets from the same answers` : " of the competitor AI names most"}, at the pace of
              closing that gap in {PACE_RANGE_MONTHS.likely} months. The shaded range runs from {PACE_RANGE_MONTHS.low} months to {PACE_RANGE_MONTHS.high}.
              The pace is our assumption: nobody has measured it. It stays level when no competitor is ahead of you.
            </li>
            {!locked && <li>
              <span className="font-semibold text-ink">Overall</span> is worked out from those two the way every scan does it: 70% Recommended
              by AI and 30% Accuracy, {SHOWN_FLOOR} while AI never names you, and held at {SHOWN_CAP} while a serious wrong fact is still around.
            </li>}
          </ul>
        </Card>

        <Card title="How we check it">
          <p className="text-[15px] leading-relaxed text-ink-soft">
            We keep every forecast we show you ({kept?.n ?? 0} so far) and will compare each one with what happened: how often the real
            result landed inside our range, and whether we tend to guess high or low. No forecast is old enough to score yet, so we do not
            claim an accuracy figure. The best check is yours: ask every new customer how they heard about you, and count the ones who say an AI tool.
          </p>
          <Note className="mt-4">
            Model version {FORECAST_MODEL_VERSION}. Benchmarks read {BENCHMARKS_AS_OF}{scanDate ? `. Mention rates from your scan of ${day(scanDate)}` : ""}.
          </Note>
        </Card>
      </div>
    </PageBody>
  );
}
