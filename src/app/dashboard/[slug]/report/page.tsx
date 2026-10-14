import Link from "next/link";
import { requirePracticeView } from "@/lib/auth";
import { LockedSection } from "@/components/locked";
import { getDb } from "@/db";
import { getOpenFindings } from "@/lib/queries";
import { buildReportData, formatMonthLabel, resolveMonthParam, reviewChanges } from "@/lib/report";
import { buildAuditReportData } from "@/report/build-report";
import { ENGINES } from "@/core/types";
import { ENGINE_NAMES } from "@/core/coverage";
import { TOOL } from "@/components/chart-keys";
import { DashboardHeader } from "@/components/dashboard-header";
import { PrintButton } from "@/components/print-button";
import { AutoPrint } from "@/components/auto-print";
import { BarRow, Card, LineChart, Note, PageBody, Quote, SiteIcon, Tag } from "@/components/ui";
import "./report.css";

const SEVERITY_WORDS: Record<string, string> = { critical: "serious", major: "important", minor: "minor" };
const MONTH_LINK = "text-[14px] font-medium text-muted underline-offset-4 hover:text-gold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold";
const AVOID_BREAK = "break-inside-avoid";

/** Shifts a "YYYY-MM" ISO month string by `delta` calendar months (UTC). */
function shiftMonth(monthISO: string, delta: number): string {
  const [year, month] = monthISO.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** How many still-open wrong facts the report lists before pointing at the Wrong facts tab. */
const OPEN_FACTS_SHOWN = 5;
/** How many recommended steps the report gives. */
const NEXT_STEPS = 3;

const LEVEL_WORDS: Record<string, string> = { low: "Little", medium: "Some", high: "A lot of" };

/** One column of the summary: a coloured heading and its short lines, or a quiet fallback. */
function ReviewColumn({ title, color, lines, empty }: { title: string; color: string; lines: string[]; empty: string }) {
  return (
    <div>
      <h3 className={`text-[13px] font-semibold uppercase tracking-[0.1em] ${color}`}>{title}</h3>
      {lines.length === 0 ? <Note className="mt-2">{empty}</Note> : (
        <ul className="mt-2 space-y-1.5">
          {lines.map(line => <li key={line} className="text-[15px] leading-snug text-ink">{line}</li>)}
        </ul>
      )}
    </div>
  );
}

/**
 * The monthly report, "Your month in review": what improved, what got worse
 * and what to do next; the scores month by month; every piece of work done;
 * the recommended next steps; then wrong facts and each AI tool.
 */
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ month?: string; print?: string }>;
}) {
  const { slug } = await params;
  const { month: monthParam, print } = await searchParams;
  const { practice, locked } = await requirePracticeView(slug);
  if (locked) {
    return (
      <PageBody>
        <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="report" />
        <LockedSection title="Monthly report" what="Your score trend, what changed and the work done for you each month." />
      </PageBody>
    );
  }
  const db = getDb();

  const month = resolveMonthParam(monthParam);

  // The recommended steps come from the latest scan, so they belong to the current month's report only.
  const isCurrentMonth = month === resolveMonthParam(undefined);
  const [report, openFindings, audit] = await Promise.all([
    buildReportData(db, practice.id, month),
    getOpenFindings(db, practice.id),
    isCurrentMonth ? buildAuditReportData(db, practice.id) : null,
  ]);
  const review = reviewChanges(report.changes);
  const nextSteps = (audit?.actions ?? []).slice(0, NEXT_STEPS);
  const hasHistory = report.months.some(m => m.overall !== null);
  const scored = report.changes.filter(c => c.key !== "named");
  const tools = report.perEngine.map((row, i) => ({ ...row, key: ENGINES[i] })).filter(row => row.total > 0);

  const monthLabel = formatMonthLabel(month);

  return (
    <PageBody>
      <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="report" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href={`/dashboard/${slug}/report?month=${shiftMonth(month, -1)}`} className={MONTH_LINK}>← Previous month</Link>
          <span className="text-[17px] font-semibold text-ink">{monthLabel}</span>
          <Link href={`/dashboard/${slug}/report?month=${shiftMonth(month, 1)}`} className={MONTH_LINK}>Next month →</Link>
        </div>
        <PrintButton />
        <AutoPrint when={print === "1"} />
      </div>

      <h1 className="mb-6 hidden text-[22px] font-semibold text-ink print:block">
        {practice.name} · {monthLabel} report
      </h1>

      <div className="space-y-4">
        <Card title="Your month in review" className={AVOID_BREAK}>
          <p className="text-[20px] leading-snug text-ink">{report.verdict}</p>
          <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 border-t border-line pt-5 sm:grid-cols-3">
            <ReviewColumn title="Improved" color="text-ok" lines={review.improved}
              empty={report.comparedTo ? `Nothing rose since ${report.comparedTo}.` : "Next month's report compares against this one."} />
            <ReviewColumn title="Got worse" color="text-flag" lines={review.worse}
              empty={report.comparedTo ? `Nothing fell since ${report.comparedTo}.` : "Nothing to compare yet."} />
            <ReviewColumn title="Do next" color="text-gold" lines={nextSteps.map(a => a.title)}
              empty={practice.reportNotes?.trim() ? "See the plan for next month below." : "No steps to recommend yet."} />
          </div>
        </Card>

        <Card title="Your progress, month by month" className={AVOID_BREAK}>
          <div className="mb-5 grid grid-cols-3 gap-4">
            {scored.map(c => {
              const change = c.now !== null && c.before !== null ? c.now - c.before : null;
              return (
                <div key={c.key}>
                  <div className={`text-[34px] font-semibold leading-none tracking-tight ${c.key === "overall" ? "text-ring-overall" : c.key === "visibility" ? "text-ring-visibility" : "text-ring-facts"}`}>
                    {c.now ?? "N/A"}
                  </div>
                  <div className="mt-1.5 text-[14px] text-ink-soft">{c.label}</div>
                  <div className={`text-[13px] ${change === null || change === 0 ? "text-muted" : change > 0 ? "font-semibold text-ok" : "font-semibold text-flag"}`}>
                    {change === null ? "No earlier month to compare" : change === 0 ? `Same as ${report.comparedTo}` : `${change > 0 ? "Up" : "Down"} ${Math.abs(change)} since ${report.comparedTo}`}
                  </div>
                </div>
              );
            })}
          </div>
          {hasHistory ? (
            <LineChart
              label="Scores by month"
              labels={report.months.map(m => m.label)}
              series={[
                { key: "overall", label: "Overall", stroke: "stroke-ring-overall", dot: "bg-ring-overall", points: report.months.map(m => m.overall) },
                { key: "visibility", label: "Recommended by AI", stroke: "stroke-ring-visibility", dot: "bg-ring-visibility", points: report.months.map(m => m.visibility) },
                { key: "facts", label: "Accuracy", stroke: "stroke-ring-facts", dot: "bg-ring-facts", points: report.months.map(m => m.facts) },
              ]}
            />
          ) : <Note>No scans were recorded in these months.</Note>}
        </Card>

        <Card title="Work done this month" aside={report.activities.length > 0 ? <span className="text-[13px] text-muted">{report.activities.length} action{report.activities.length === 1 ? "" : "s"}</span> : undefined}>
          {report.activities.length === 0 ? (
            <Note>No work was logged this month.</Note>
          ) : (
            <ul className="divide-y divide-line">
              {report.activities.map((description, i) => (
                <li key={i} className="py-2.5 text-[15px] text-ink">{description}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="What to do next" className={AVOID_BREAK}>
          {nextSteps.length > 0 && (
            <ol className="space-y-4">
              {nextSteps.map((a, i) => (
                <li key={a.id} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold text-[14px] font-semibold text-paper">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="text-[16px] font-semibold leading-snug text-ink">{a.title}</div>
                    <Note className="mt-0.5">{a.why}</Note>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Tag>{LEVEL_WORDS[a.effort] ?? a.effort} effort</Tag>
                      <Tag tone="gold">{LEVEL_WORDS[a.impact] ?? a.impact} impact</Tag>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {practice.reportNotes?.trim() ? (
            <div className={nextSteps.length > 0 ? "mt-5 border-t border-line pt-4" : ""}>
              <p className="mb-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-muted">Our plan for next month</p>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">{practice.reportNotes}</p>
            </div>
          ) : nextSteps.length === 0 && <Note>No steps to recommend yet.</Note>}
        </Card>

        <Card title="Wrong facts" className={AVOID_BREAK}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {([
              ["Found", report.accuracyLedger.found, "text-flag"],
              ["Fixed", report.accuracyLedger.fixed, "text-gold"],
              ["Confirmed fixed", report.accuracyLedger.verified, "text-ok"],
              ["Still open", report.accuracyLedger.open, "text-ink"],
            ] as const).map(([label, count, color]) => (
              <div key={label}>
                <div className={`text-[28px] font-semibold leading-none tracking-tight ${color}`}>{count}</div>
                <div className="mt-1.5 text-[13px] text-muted">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-line pt-4">
            {openFindings.length === 0 ? (
              <Note>No wrong facts are open.</Note>
            ) : (
              <>
                <ul className="space-y-2">
                  {openFindings.slice(0, OPEN_FACTS_SHOWN).map(f => (
                    <li key={f.id} className="text-[15px] leading-relaxed text-ink-soft">
                      {f.claim}
                      {f.factValue ? `. The truth: ${f.factValue}` : ""} ({SEVERITY_WORDS[f.severity] ?? f.severity})
                    </li>
                  ))}
                </ul>
                {openFindings.length > OPEN_FACTS_SHOWN && (
                  <p className="mt-3 text-[14px] text-muted">
                    And {openFindings.length - OPEN_FACTS_SHOWN} more.{" "}
                    <Link href={`/dashboard/${slug}/fixes`} className="font-semibold text-ink underline decoration-gold underline-offset-4 hover:text-gold print:hidden">See them all</Link>
                  </p>
                )}
              </>
            )}
          </div>
        </Card>

        {tools.length > 0 && (
          <Card title="How often each AI tool named you" className={AVOID_BREAK} aside={<span className="text-[13px] text-muted">Questions that didn&apos;t use your name</span>}>
            <ul className="space-y-3">
              {tools.map(row => (
                <BarRow
                  key={row.key}
                  icon={<SiteIcon domain={TOOL[row.key].site} />}
                  label={ENGINE_NAMES[row.key]}
                  fill="bg-ring-visibility"
                  fraction={row.cited / row.total}
                  value={`${row.cited} of ${row.total}`}
                />
              ))}
            </ul>
          </Card>
        )}

        {report.bestQuote && (
          <Card title="Best thing AI said about you" className={AVOID_BREAK}>
            {/* AI tools write in Markdown; the marks are noise in a quote. */}
            <Quote>&ldquo;{report.bestQuote.snippet.replace(/[#*_`]+/g, "").replace(/\s+/g, " ").trim()}&rdquo;</Quote>
            <Note className="mt-3">{report.bestQuote.engine}, asked &ldquo;{report.bestQuote.prompt}&rdquo;</Note>
          </Card>
        )}
      </div>
    </PageBody>
  );
}
