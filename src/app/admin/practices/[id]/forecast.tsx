import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { practices } from "@/db/schema";
import { buyForecastDemand, saveForecastSetup, suggestForecastSetup } from "@/app/admin/forecast-actions";
import { Card, Note, Table } from "@/components/ui";
import { Button, Notice, Select, TextArea, TextInput, formatDate } from "@/app/admin/ui";
import { BUSINESS_TYPES, BUSINESS_TYPE_LABEL, rangeWords, wholeNumber } from "@/core/forecast";
import { loadForecast } from "@/services/forecast";

async function handleSave(practiceId: string, formData: FormData): Promise<void> {
  "use server";
  await saveForecastSetup(practiceId, {
    area: String(formData.get("area") ?? ""),
    businessType: String(formData.get("businessType") ?? ""),
    keywords: String(formData.get("keywords") ?? ""),
  });
}

async function handleSuggest(practiceId: string): Promise<void> {
  "use server";
  await suggestForecastSetup(practiceId);
}

async function handleBuy(practiceId: string): Promise<void> {
  "use server";
  await buyForecastDemand(practiceId);
}

const REASON = {
  no_demand: "No search numbers yet. Set the area and the search terms, then get the numbers.",
  no_scan: "Needs a finished scan with at least 12 answers.",
  no_competitor: "The latest scan named no competitor, so there is no gap to forecast.",
  need_rates: "No benchmark for this kind of business. Pick a closer kind, or add the owner's own rates on their Forecast page.",
};

/**
 * What the customer's forecast is built on: the area they sell in, the
 * searches a buyer types, and Google's monthly count for each. The owner's
 * own rates are set on their Forecast page.
 */
export async function ForecastSetupSection({ practiceId, slug, error }: { practiceId: string; slug: string; error?: string }) {
  const db = getDb();
  const [practice] = await db.select({ id: practices.id, forecast: practices.forecast }).from(practices).where(eq(practices.id, practiceId));
  if (!practice) return null;
  const { setup, result } = await loadForecast(db, practice);
  const uncounted = setup.keywords.filter(k => k.searches === null).length;

  return (
    <section id="forecast" className="scroll-mt-6">
      <Card title="Forecast">
        <Note>
          The forecast multiplies local search demand by the gap between this business and the competitor AI names most. The kind of
          business, the area and the searches are drafted by AI when their website is read. Confirm them on the call, then get
          Google&apos;s count for each search.
        </Note>
        {error && <Notice tone="flag" className="mt-4">{error}</Notice>}
        <Notice tone={result.ready ? "ok" : "neutral"} className="mt-4">
          {result.ready
            ? result.forecast.ahead
              ? `No gap: AI names them as often as ${result.forecast.competitor}.`
              : `Showing about ${wholeNumber(result.forecast.leads.likely)} more leads a year (${rangeWords(result.forecast.leads)}) against ${result.forecast.competitor}, from ${result.forecast.monthlySearches.toLocaleString("en-US")} searches a month.`
            : REASON[result.reason]}
          {" "}<a href={`/dashboard/${slug}/forecast`} className="font-semibold underline">Open their forecast</a>
        </Notice>

        <form action={handleSave.bind(null, practiceId)} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-[14px] font-medium text-ink">
              Area they sell in
              <TextInput name="area" defaultValue={setup.area ?? ""} placeholder="Los Angeles,California,United States" className="mt-1.5 w-full" />
            </label>
            <label className="block text-[14px] font-medium text-ink">
              Kind of business
              <Select name="businessType" defaultValue={setup.businessType} className="mt-1.5 w-full">
                {BUSINESS_TYPES.map(t => <option key={t} value={t}>{BUSINESS_TYPE_LABEL[t]}</option>)}
              </Select>
            </label>
          </div>
          <Note>
            Write the area as City,State,United States, or just United States for a business that sells everywhere. Pick the area their
            customers come from, not only the town they are in: it changes the number more than anything else here.
          </Note>
          <label className="block text-[14px] font-medium text-ink">
            Searches a buyer types into Google, one a line
            <TextArea name="keywords" rows={8} defaultValue={setup.keywords.map(k => k.keyword).join("\n")}
              placeholder={"med spa\nbotox near me\nlip filler"} className="mt-1.5 w-full font-mono text-[14px]" />
          </label>
          <Note>Short searches, one to four words. Google has no count for long questions.</Note>
          <Button>Save</Button>
        </form>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <form action={handleSuggest.bind(null, practiceId)}><Button variant="outline">Fill in with AI</Button></form>
          <form action={handleBuy.bind(null, practiceId)}><Button variant="outline">Get search numbers (about 9 cents)</Button></form>
          <Note className="min-w-[200px] flex-1">
            {setup.demandAt ? `Numbers last bought ${formatDate(new Date(setup.demandAt))}.` : "No numbers bought yet."}
            {uncounted > 0 && setup.demandAt ? ` ${uncounted} search${uncounted === 1 ? " has" : "es have"} no number and ${uncounted === 1 ? "is" : "are"} left out.` : ""}
          </Note>
        </div>

        {setup.demandAt && (
          <div className="mt-4">
            <Table
              head={["Search", "A month", "Price of a click"]}
              right={[1, 2]}
              rows={[...setup.keywords].sort((a, b) => (b.searches ?? -1) - (a.searches ?? -1))
                .map(k => [k.keyword, k.searches === null ? "No number" : k.searches.toLocaleString("en-US"), k.cpc === null ? "" : `$${k.cpc.toFixed(2)}`])}
            />
          </div>
        )}
      </Card>
    </section>
  );
}
