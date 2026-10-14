import { getDb } from "@/db";
import { Card } from "@/components/ui";
import { ScoreForecastChart, scoreLines } from "@/components/forecast-charts";
import { loadForecast, type ForecastSetup } from "@/services/forecast";
import { loadAccuracyForecast } from "@/services/accuracy-forecast";
import { PACE_MONTHS, growthPath, leadNoun, wholeNumber } from "@/core/forecast";

/**
 * The forecast in one card for the Overview page: where the three scores are
 * heading, as the same chart the Forecast page shows, and the year's extra
 * leads in a line. The whole card is a link to the Forecast page. Shows nothing when
 * there is nothing to forecast yet.
 */
export async function ForecastCard({ slug, practice }: {
  slug: string;
  practice: { id: string; website: string | null; forecast: ForecastSetup | null };
}) {
  const db = getDb();
  const [{ setup, result }, accuracy] = await Promise.all([loadForecast(db, practice), loadAccuracyForecast(db, practice)]);
  const forecast = result.ready && !result.forecast.ahead ? result.forecast : null;
  const year = forecast ? growthPath(forecast, setup).at(-1)! : null;
  const lines = scoreLines(accuracy.history, accuracy.scores);
  // The headline names the score that sums the chart up: Overall, or whichever the scans have produced.
  const { overall, visibility, facts } = accuracy.scores;
  const pick = overall ? { label: "Overall", text: "text-ring-overall", line: overall }
    : visibility ? { label: "Recommended by AI", text: "text-ring-visibility", line: visibility }
    : facts ? { label: "Accuracy", text: "text-ring-facts", line: facts } : null;
  const headline = pick && { label: pick.label, text: pick.text, now: pick.line.now, end: pick.line.points[pick.line.points.length - 1] };
  if (lines.length === 0 && !year) return null;
  const noun = leadNoun(setup.businessType);

  return (
    <Card title="GEO forecast" href={`/dashboard/${slug}/forecast`}>
      <div className="flex flex-wrap gap-x-10 gap-y-2">
        {headline && (
          <p className="text-[17px] text-ink-soft">
            {headline.label} <span className="font-semibold text-ink">{headline.now}</span> today, about <span className={`font-semibold ${headline.text}`}>{headline.end.likely}</span> in {headline.end.month} months
          </p>
        )}
        {year && (
          <p className="text-[17px] text-ink-soft">
            About <span className="font-semibold text-ring-visibility">{year.leads.likely < 0.5 ? "fewer than 1" : wholeNumber(year.leads.likely)}</span> more {noun}{Math.round(year.leads.likely) === 1 ? "" : "s"} in {PACE_MONTHS} months
          </p>
        )}
      </div>
      {lines.length > 0 && (
        <div className="mt-3">
          <ScoreForecastChart compact lines={lines} pastLabels={accuracy.history.map(() => "")} />
        </div>
      )}
    </Card>
  );
}
