import Link from "next/link";
import { requirePracticeAccess } from "@/lib/auth";
import { getDb } from "@/db";
import { getOpenFindings } from "@/lib/queries";
import { buildReportData, formatMonthLabel } from "@/lib/report";
import { DashboardHeader } from "@/components/dashboard-header";
import { PrintButton } from "@/components/print-button";
import "./report.css";

function currentMonthISO(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Shifts a "YYYY-MM" ISO month string by `delta` calendar months (UTC). */
function shiftMonth(monthISO: string, delta: number): string {
  const [year, month] = monthISO.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { slug } = await params;
  const { month: monthParam } = await searchParams;
  const practice = await requirePracticeAccess(slug);
  const db = getDb();

  const month = monthParam ?? currentMonthISO();

  const [report, openFindings] = await Promise.all([
    buildReportData(db, practice.id, month),
    getOpenFindings(db, practice.id),
  ]);

  const monthLabel = formatMonthLabel(month);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <DashboardHeader slug={slug} practiceName={practice.name} active="report" />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/dashboard/${slug}/report?month=${shiftMonth(month, -1)}`}
            className="text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
          >
            ← Previous month
          </Link>
          <span className="font-medium text-black dark:text-zinc-50">{monthLabel}</span>
          <Link
            href={`/dashboard/${slug}/report?month=${shiftMonth(month, 1)}`}
            className="text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
          >
            Next month →
          </Link>
        </div>
        <PrintButton />
      </div>

      <h1 className="mb-8 hidden text-xl font-semibold text-black print:block">
        {practice.name} — {monthLabel} report
      </h1>

      {/* 1. Verdict */}
      <section className="mb-10 break-inside-avoid">
        <p className="text-lg text-black dark:text-zinc-50">{report.verdict}</p>
      </section>

      {/* 2. Score + trend */}
      <section className="mb-10 break-inside-avoid">
        <h2 className="mb-3 text-sm font-medium text-black dark:text-zinc-50">Score</h2>
        <p className="mb-4 text-3xl font-semibold text-black dark:text-zinc-50">
          {report.score ?? "—"}
          {report.score !== null && report.prevMonthScore !== null && (
            <span className="ml-2 text-base font-normal text-zinc-500 dark:text-zinc-400">
              ({report.score - report.prevMonthScore >= 0 ? "+" : ""}
              {report.score - report.prevMonthScore} vs last month)
            </span>
          )}
        </p>
        {report.trend.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No scans recorded this month.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {report.trend.map((point, i) => (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4 text-black dark:text-zinc-50">{point.date.slice(0, 10)}</td>
                  <td className="py-2 text-black dark:text-zinc-50">{point.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 3. Accuracy ledger */}
      <section className="mb-10 break-inside-avoid">
        <h2 className="mb-3 text-sm font-medium text-black dark:text-zinc-50">Accuracy ledger</h2>
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Found</p>
            <p className="text-xl font-semibold text-black dark:text-zinc-50">{report.accuracyLedger.found}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Fixed</p>
            <p className="text-xl font-semibold text-black dark:text-zinc-50">{report.accuracyLedger.fixed}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Verified</p>
            <p className="text-xl font-semibold text-black dark:text-zinc-50">{report.accuracyLedger.verified}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Open</p>
            <p className="text-xl font-semibold text-black dark:text-zinc-50">{report.accuracyLedger.open}</p>
          </div>
        </div>
        {openFindings.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No open accuracy issues.</p>
        ) : (
          <ul className="space-y-1">
            {openFindings.map(f => (
              <li key={f.id} className="text-sm text-zinc-700 dark:text-zinc-300">
                {f.claim}
                {f.factValue ? ` — should be: ${f.factValue}` : ""} ({f.severity})
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4. Per-engine table */}
      <section className="mb-10 break-inside-avoid">
        <h2 className="mb-3 text-sm font-medium text-black dark:text-zinc-50">Per-engine citation rate</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="py-2 pr-4 font-medium">Engine</th>
              <th className="py-2 pr-4 font-medium">Cited</th>
              <th className="py-2 font-medium">Total checks</th>
            </tr>
          </thead>
          <tbody>
            {report.perEngine.map(row => (
              <tr key={row.engine} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-4 text-black dark:text-zinc-50">{row.engine}</td>
                <td className="py-2 pr-4 text-black dark:text-zinc-50">{row.cited}</td>
                <td className="py-2 text-black dark:text-zinc-50">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 5. Activity list */}
      <section className="mb-10 break-inside-avoid">
        <h2 className="mb-3 text-sm font-medium text-black dark:text-zinc-50">Activity this month</h2>
        {report.activities.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No activity recorded this month.</p>
        ) : (
          <ul className="space-y-2">
            {report.activities.map((description, i) => (
              <li key={i} className="text-sm text-zinc-600 dark:text-zinc-400">
                {description}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 6. Practice notes */}
      <section className="mb-10 break-inside-avoid">
        <h2 className="mb-3 text-sm font-medium text-black dark:text-zinc-50">Next month</h2>
        <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
          {practice.reportNotes?.trim() ? practice.reportNotes : "No notes yet."}
        </p>
      </section>

      {/* 7. Best quote */}
      {report.bestQuote && (
        <section className="mb-10 break-inside-avoid">
          <h2 className="mb-3 text-sm font-medium text-black dark:text-zinc-50">Best quote</h2>
          <blockquote className="border-l-2 border-zinc-300 pl-4 text-sm text-zinc-700 italic dark:border-zinc-700 dark:text-zinc-300">
            &ldquo;{report.bestQuote.snippet}&rdquo;
            <footer className="mt-1 text-xs text-zinc-500 not-italic dark:text-zinc-400">
              — {report.bestQuote.engine}, on &ldquo;{report.bestQuote.prompt}&rdquo;
            </footer>
          </blockquote>
        </section>
      )}
    </div>
  );
}
