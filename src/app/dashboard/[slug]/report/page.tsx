import Link from "next/link";
import { requirePracticeView } from "@/lib/auth";
import { LockedSection } from "@/components/locked";
import { getDb } from "@/db";
import { getOpenFindings } from "@/lib/queries";
import { buildReportData, formatMonthLabel, resolveMonthParam } from "@/lib/report";
import { DashboardHeader } from "@/components/dashboard-header";
import { PrintButton } from "@/components/print-button";
import { AutoPrint } from "@/components/auto-print";
import { Card, Note, PageBody, Quote, Stat, Table } from "@/components/ui";
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

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** The monthly report: the month in one sentence, the score, wrong facts, each AI tool, and the work done. */
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

  const [report, openFindings] = await Promise.all([
    buildReportData(db, practice.id, month),
    getOpenFindings(db, practice.id),
  ]);

  const monthLabel = formatMonthLabel(month);
  const change = report.score !== null && report.prevMonthScore !== null ? report.score - report.prevMonthScore : null;

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
        <Card title="This month" className={AVOID_BREAK}>
          <p className="text-[20px] leading-snug text-ink">{report.verdict}</p>
        </Card>

        <Card title="Overall score" className={AVOID_BREAK}>
          <Stat
            value={report.score ?? "N/A"}
            unit={change === null ? undefined : change === 0 ? "same as last month" : `${change > 0 ? "up" : "down"} ${Math.abs(change)} from last month`}
            tone="gold"
          />
          <div className="mt-4">
            {report.trend.length === 0 ? (
              <Note>No scans were recorded this month.</Note>
            ) : (
              <Table head={["Scan date", "Overall"]} right={[1]} rows={report.trend.map(point => [shortDate(point.date), point.score])} />
            )}
          </div>
        </Card>

        <Card title="Wrong facts" className={AVOID_BREAK}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {([
              ["Found", report.accuracyLedger.found],
              ["Fixed", report.accuracyLedger.fixed],
              ["Confirmed fixed", report.accuracyLedger.verified],
              ["Still open", report.accuracyLedger.open],
            ] as const).map(([label, count]) => (
              <div key={label}>
                <div className="text-[28px] font-semibold leading-none tracking-tight text-ink">{count}</div>
                <div className="mt-1.5 text-[13px] text-muted">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-line pt-4">
            {openFindings.length === 0 ? (
              <Note>No wrong facts are open.</Note>
            ) : (
              <ul className="space-y-2">
                {openFindings.map(f => (
                  <li key={f.id} className="text-[15px] leading-relaxed text-ink-soft">
                    {f.claim}
                    {f.factValue ? `. The truth: ${f.factValue}` : ""} ({SEVERITY_WORDS[f.severity] ?? f.severity})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card title="How often each AI tool named you" className={AVOID_BREAK}>
          <Note>
            Only questions that did not use your name are counted. Ask about you by name and AI names you every time, so those questions test Accuracy, not how often you are recommended.
          </Note>
          <div className="mt-3">
            <Table
              head={["AI tool", "Named you", "Answers"]}
              right={[1, 2]}
              rows={report.perEngine.map(row => [row.engine, row.cited, row.total])}
            />
          </div>
        </Card>

        <Card title="Work done this month" className={AVOID_BREAK}>
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

        <Card title="Next month" className={AVOID_BREAK}>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">
            {practice.reportNotes?.trim() ? practice.reportNotes : "No notes yet."}
          </p>
        </Card>

        {report.bestQuote && (
          <Card title="Best thing AI said about you" className={AVOID_BREAK}>
            <Quote>&ldquo;{report.bestQuote.snippet}&rdquo;</Quote>
            <Note className="mt-3">{report.bestQuote.engine}, asked &ldquo;{report.bestQuote.prompt}&rdquo;</Note>
          </Card>
        )}
      </div>
    </PageBody>
  );
}
