import { requirePracticeAccess } from "@/lib/auth";
import { getDb } from "@/db";
import { getLatestScan, getChecksForScan } from "@/lib/queries";
import { buildSourcesReport, SOURCE_KIND_LABELS, type SourceRow } from "@/core/citations";
import { DashboardHeader } from "@/components/dashboard-header";
import { buildSearchReport } from "@/core/search-queries";
import { ENGINE_LABELS, type Engine } from "@/core/types";

// The long tail of one-off domains is real but not the story.
const SOURCE_LIMIT = 15;
const GAP_LIMIT = 10;

function pct(n: number, of: number): string {
  return of ? `${Math.round((n / of) * 100)}%` : "0%";
}

function SourceTable({ rows, total, emphasis }: { rows: SourceRow[]; total: number; emphasis: "answers" | "gap" }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-3 py-2">Site</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2 text-right">{emphasis === "gap" ? "Cited for a competitor" : "Answers citing it"}</th>
            <th className="px-3 py-2 text-right">Named you</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map(row => (
            <tr key={row.domain}>
              <td className="px-3 py-2 font-medium text-black dark:text-zinc-50">{row.domain}</td>
              <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{SOURCE_KIND_LABELS[row.kind]}</td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                {emphasis === "gap" ? row.competitorOnly : `${row.answers} (${pct(row.answers, total)})`}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{row.namedYou}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function SourcesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const practice = await requirePracticeAccess(slug);
  const db = getDb();
  const latestScan = await getLatestScan(db, practice.id);

  if (!latestScan) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <DashboardHeader slug={slug} practiceName={practice.name} active="sources" />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Your first scan is running. Check back soon.</p>
      </div>
    );
  }

  const checks = await getChecksForScan(db, latestScan.id);
  const report = buildSourcesReport(checks, practice.website);
  const searches = buildSearchReport(checks);
  const maxKind = Math.max(1, ...report.kindMix.map(k => k.answers));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <DashboardHeader slug={slug} practiceName={practice.name} active="sources" />

      <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        The websites AI engines read before answering your customers&apos; questions. {report.answersWithSources} of{" "}
        {report.totalAnswers} answers cited at least one source. Questions that include your name are left out,
        since they don&apos;t show where AI goes when it has to choose.
      </p>

      {report.answersWithSources === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No answers in the latest scan cited a source.</p>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="mb-1 text-sm font-medium text-black dark:text-zinc-50">What kind of sites AI trusts</h2>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              Your own website was cited in {Math.round(report.ownSiteRate * 100)}%{" "}
              of answers with sources.
            </p>
            <ul className="space-y-2">
              {report.kindMix.map(k => (
                <li key={k.kind} className="flex items-center gap-3 text-sm">
                  <span className="w-48 shrink-0 text-zinc-700 dark:text-zinc-300">{SOURCE_KIND_LABELS[k.kind]}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <span
                      className={k.kind === "own_site" ? "block h-full rounded-full bg-indigo-500" : "block h-full rounded-full bg-zinc-400 dark:bg-zinc-600"}
                      style={{ width: `${Math.round((k.answers / maxKind) * 100)}%` }}
                    />
                  </span>
                  <span className="w-24 shrink-0 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                    {k.answers} answer{k.answers === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-1 text-sm font-medium text-black dark:text-zinc-50">Where competitors are winning</h2>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              Sites AI cited when it recommended a competitor and not you. These are the pages to get onto.
            </p>
            {report.gaps.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                None this week: every time a competitor was recommended, you were too.
              </p>
            ) : (
              <SourceTable rows={report.gaps.slice(0, GAP_LIMIT)} total={report.answersWithSources} emphasis="gap" />
            )}
          </section>

          {searches.answersWithSearches > 0 && (
            <section>
              <h2 className="mb-1 text-sm font-medium text-black dark:text-zinc-50">What AI searched for</h2>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                Before answering, the engines ran about {searches.searchesPerAnswer.toFixed(1)} web searches per question.
                The words they add are the kind of page they go looking for.
              </p>
              {searches.addedWords.length > 0 && (
                <p className="mb-3 text-sm text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium text-black dark:text-zinc-50">Words AI added most:</span>{" "}
                  {searches.addedWords.slice(0, 8).map(w => w.word).join(", ")}
                </p>
              )}
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                    <tr>
                      <th className="px-3 py-2">Search</th>
                      <th className="px-3 py-2">Engines</th>
                      <th className="px-3 py-2 text-right">Answers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {searches.queries.slice(0, 12).map(q => (
                      <tr key={q.query}>
                        <td className="px-3 py-2 text-black dark:text-zinc-50">{q.query}</td>
                        <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                          {q.engines.map(e => ENGINE_LABELS[e as Engine] ?? e).join(", ")}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{q.answers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-1 text-sm font-medium text-black dark:text-zinc-50">Most-cited sites</h2>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              Every site AI leaned on this week, most-cited first.
            </p>
            <SourceTable rows={report.sources.slice(0, SOURCE_LIMIT)} total={report.answersWithSources} emphasis="answers" />
            {report.sources.length > SOURCE_LIMIT && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Plus {report.sources.length - SOURCE_LIMIT} more sites cited once or twice.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
