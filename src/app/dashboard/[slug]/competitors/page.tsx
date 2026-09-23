import { eq } from "drizzle-orm";
import { requirePracticeAccess } from "@/lib/auth";
import { getDb } from "@/db";
import { nameVariations } from "@/db/schema";
import { getLatestScan, getChecksForScan } from "@/lib/queries";
import { buildCompetitorReport, type CompetitorCell } from "@/lib/competitor-report";
import { ENGINE_LABELS } from "@/core/types";
import { DashboardHeader } from "@/components/dashboard-header";

// A real scan names 40 to 60 distinct businesses. The top of the list is the
// story; the long tail of one-mention names is available but folded away.
const LEADERBOARD_LIMIT = 15;

/** How each engine ordered the businesses it named for one question. */
function Cell({ cell }: { cell: CompetitorCell | undefined }) {
  if (!cell) {
    return <span className="text-xs text-zinc-400 dark:text-zinc-500">No answer</span>;
  }
  if (cell.names.length === 0) {
    return <span className="text-xs text-zinc-400 dark:text-zinc-500">No businesses named</span>;
  }
  return (
    <ol className="space-y-1">
      {cell.names.map((name, i) => (
        <li
          key={`${name}-${i}`}
          className={
            i === cell.practiceIndex
              ? "rounded bg-indigo-100 px-1.5 py-0.5 font-medium text-black dark:bg-indigo-900/60 dark:text-zinc-50"
              : "px-1.5 py-0.5 text-zinc-700 dark:text-zinc-300"
          }
        >
          <span className="mr-1.5 tabular-nums text-zinc-400 dark:text-zinc-500">{i + 1}.</span>
          {name}
        </li>
      ))}
      {cell.practiceIndex === -1 && (
        <li className="px-1.5 py-0.5 text-xs italic text-rose-700 dark:text-rose-400">You were not named</li>
      )}
    </ol>
  );
}

function ShareRow({
  row, rank, maxMentions, totalChecks,
}: {
  row: { name: string; mentions: number; isPractice: boolean };
  rank: number;
  maxMentions: number;
  totalChecks: number;
}) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="w-6 shrink-0 tabular-nums text-zinc-400 dark:text-zinc-500">{rank}.</span>
      <span
        className={
          row.isPractice
            ? "w-48 shrink-0 truncate font-medium text-black dark:text-zinc-50"
            : "w-48 shrink-0 truncate text-zinc-700 dark:text-zinc-300"
        }
      >
        {row.name}
        {row.isPractice && <span className="ml-1.5 text-xs font-normal text-zinc-500 dark:text-zinc-400">you</span>}
      </span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
        <span
          className={row.isPractice ? "block h-full rounded-full bg-indigo-500" : "block h-full rounded-full bg-zinc-400 dark:bg-zinc-600"}
          style={{ width: `${Math.round((row.mentions / maxMentions) * 100)}%` }}
        />
      </span>
      <span className="w-20 shrink-0 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
        {row.mentions} of {totalChecks}
      </span>
    </li>
  );
}

export default async function CompetitorsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const practice = await requirePracticeAccess(slug);
  const db = getDb();

  const latestScan = await getLatestScan(db, practice.id);

  if (!latestScan) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <DashboardHeader slug={slug} practiceName={practice.name} active="competitors" />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Your first scan is running. Check back soon.</p>
      </div>
    );
  }

  const [variationRows, checks] = await Promise.all([
    db.select().from(nameVariations).where(eq(nameVariations.practiceId, practice.id)),
    getChecksForScan(db, latestScan.id),
  ]);
  const practiceNames = Array.from(new Set([practice.name, ...variationRows.map(v => v.text)]));
  const report = buildCompetitorReport(checks, practiceNames);
  const maxMentions = Math.max(1, ...report.shareOfVoice.map(s => s.mentions));
  // Never fold the practice's own row away, even when it sits in the tail.
  const practiceRank = report.shareOfVoice.findIndex(s => s.isPractice);
  const visibleCount = Math.max(LEADERBOARD_LIMIT, practiceRank + 1);
  const leaders = report.shareOfVoice.slice(0, visibleCount);
  const tail = report.shareOfVoice.slice(visibleCount);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <DashboardHeader slug={slug} practiceName={practice.name} active="competitors" />

      <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        Every business the AI engines recommended this week, discovered from their actual answers.
        Counts are out of {report.totalChecks} answers.
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-black dark:text-zinc-50">Share of voice</h2>
        {report.shareOfVoice.length <= 1 && report.shareOfVoice[0]?.mentions === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No businesses were named in the latest scan.</p>
        ) : (
          <>
            <ol className="space-y-2">
              {leaders.map((row, i) => <ShareRow key={row.name} row={row} rank={i + 1} maxMentions={maxMentions} totalChecks={report.totalChecks} />)}
            </ol>
            {tail.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-zinc-500 dark:text-zinc-400">
                  {tail.length} more named once or twice
                </summary>
                <ol className="mt-2 space-y-2">
                  {tail.map((row, i) => <ShareRow key={row.name} row={row} rank={visibleCount + i + 1} maxMentions={maxMentions} totalChecks={report.totalChecks} />)}
                </ol>
              </details>
            )}
          </>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-black dark:text-zinc-50">Head to head</h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          For each question, who each engine named and in what order. Your practice is highlighted.
        </p>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2">Question</th>
                {report.engines.map(engine => (
                  <th key={engine} className="px-3 py-2">{ENGINE_LABELS[engine]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {report.rows.map(row => (
                <tr key={row.promptText} className="align-top">
                  <td className="min-w-48 px-3 py-3 text-zinc-700 dark:text-zinc-300">{row.promptText}</td>
                  {report.engines.map(engine => (
                    <td key={engine} className="min-w-44 px-3 py-3">
                      <Cell cell={row.cells[engine]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
