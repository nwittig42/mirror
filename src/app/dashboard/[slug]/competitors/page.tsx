import { eq } from "drizzle-orm";
import { requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import { nameVariations } from "@/db/schema";
import { getLatestScan, getChecksForScan } from "@/lib/queries";
import { buildCompetitorReport, type CompetitorCell } from "@/lib/competitor-report";
import { buildSourcesReport, domainOf, SOURCE_KIND_LABELS } from "@/core/citations";
import { brandDomains } from "@/core/brand-domain";
import { nameKey } from "@/core/competitors";
import { buildSearchReport } from "@/core/search-queries";
import { ENGINES, type Engine } from "@/core/types";
import { ENGINE_NAMES } from "@/core/coverage";
import { KIND_FILL, TOOL } from "@/components/chart-keys";
import { DashboardHeader } from "@/components/dashboard-header";
import { OneTimeAuditCard } from "@/components/locked";
import { BarRow, BrandIcon, Card, Note, PageBody, SectionTitle, SiteIcon, SplitBar, Table } from "@/components/ui";

// A real scan names 40 to 60 distinct businesses. The top of the list is the
// story; the long tail of one-mention names is available but folded away.
const LEADERBOARD_LIMIT = 10;
// The long tail of one-off websites is real but not the story.
const SOURCE_LIMIT = 10;
const GAP_LIMIT = 8;
const SEARCH_LIMIT = 8;

const FOLD = "cursor-pointer text-[14px] font-semibold text-muted hover:text-ink";

/** Bar colours on the ranking: businesses named more than the customer (clay), the customer (gold), and the rest (emerald). */
const AHEAD = "bg-ring-facts";
const YOU = "bg-gold";
const BEHIND = "bg-teal";

type Mark = { domain?: string; logo?: string | null };

/** A big number with a line under it. */
function Tile({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-paper px-6 py-5">
      <span className={`display block text-[40px] leading-none tabular-nums ${color}`}>{value}</span>
      <span className="mt-1.5 block text-[14px] text-muted">{label}</span>
    </div>
  );
}

/** The businesses one AI tool named for one question, in the order it named them. */
function NamedList({ cell, markOf }: { cell: CompetitorCell | undefined; markOf: (name: string) => Mark }) {
  if (!cell) return <p className="text-[14px] text-muted">No answer</p>;
  if (cell.names.length === 0) return <p className="text-[14px] text-muted">No businesses named</p>;
  return (
    <ol className="space-y-1 text-[14px]">
      {cell.names.map((name, i) => (
        <li key={`${name}-${i}`}
          className={`flex items-center gap-2 px-1.5 py-0.5 ${i === cell.practiceIndex ? "rounded bg-gold-soft font-semibold text-ink" : "text-ink-soft"}`}>
          <span className="w-4 shrink-0 tabular-nums text-muted">{i + 1}.</span>
          <BrandIcon name={name} {...markOf(name)} size={16} />
          <span className="min-w-0 truncate">{name}</span>
        </li>
      ))}
      {cell.practiceIndex === -1 && <li className="px-1.5 py-0.5 text-flag">You were not named</li>}
    </ol>
  );
}

/**
 * Competitors: who AI names most and who it named for each question, then
 * the websites it read to decide. Nothing here rests on the fact check, so
 * a free account (before their call) sees all of it, as a client does.
 */
export default async function CompetitorsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { practice, locked } = await requirePracticeView(slug);
  const db = getDb();
  const latestScan = await getLatestScan(db, practice.id);

  if (!latestScan) {
    return (
      <PageBody>
        <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="competitors" />
        <Card title="Competitors">
          <Note>Your first scan is running. Your competitors show up here when it finishes.</Note>
        </Card>
      </PageBody>
    );
  }

  const [variationRows, checks] = await Promise.all([
    db.select().from(nameVariations).where(eq(nameVariations.practiceId, practice.id)),
    getChecksForScan(db, latestScan.id),
  ]);
  if (checks.length === 0) {
    return (
      <PageBody>
        <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="competitors" />
        <Card title="Competitors">
          <Note>The latest scan has no answers yet. Your competitors show up here when it finishes.</Note>
        </Card>
      </PageBody>
    );
  }
  const practiceNames = Array.from(new Set([practice.name, ...variationRows.map(v => v.text)]));
  // Buyer questions only, as the report's leaderboard and the summary count
  // it: a question that names the business names it back every time.
  const report = buildCompetitorReport(checks.filter(c => c.promptKind !== "branded"), practiceNames);
  const maxMentions = Math.max(1, ...report.shareOfVoice.map(s => s.mentions));
  // Never fold the business's own row away, even when it sits in the tail.
  const ownRank = report.shareOfVoice.findIndex(s => s.isPractice);
  const visibleCount = Math.max(LEADERBOARD_LIMIT, ownRank + 1);
  const leaders = report.shareOfVoice.slice(0, visibleCount);
  const tail = report.shareOfVoice.slice(visibleCount);
  const nobodyNamed = report.shareOfVoice.every(s => s.mentions === 0);

  const sources = buildSourcesReport(checks, practice.website);
  const searches = buildSearchReport(checks);

  // A named business gets its logo from the website the same scan's answers read, when one carries its name.
  const cited = new Map<string, number>();
  for (const c of checks) for (const d of new Set(c.citations.map(domainOf).filter((x): x is string => x !== null))) cited.set(d, (cited.get(d) ?? 0) + 1);
  const citedDomains = [...cited.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([d]) => d);
  const everyName = [...new Set([...report.shareOfVoice.map(r => r.name), ...checks.flatMap(c => c.namedOrder)])];
  const domainByName = brandDomains(everyName, citedDomains);
  const practiceKeys = new Set(practiceNames.map(nameKey));
  const markOf = (name: string): Mark =>
    practiceKeys.has(nameKey(name)) && practice.logo ? { logo: practice.logo } : { domain: domainByName.get(name) };

  const own = report.shareOfVoice[ownRank];
  const ahead = report.shareOfVoice.filter(r => !r.isPractice && r.mentions > (own?.mentions ?? 0)).length;
  const behind = report.shareOfVoice.filter(r => !r.isPractice && r.mentions < (own?.mentions ?? 0)).length;

  const shareRow = (row: (typeof leaders)[number], rank: number) => (
    <BarRow
      key={row.name}
      rank={rank}
      highlight={row.isPractice}
      icon={<BrandIcon name={row.name} {...markOf(row.name)} />}
      fill={row.isPractice ? YOU : row.mentions > (own?.mentions ?? 0) ? AHEAD : BEHIND}
      label={row.isPractice ? <>{row.name} <span className="text-[13px] font-normal text-muted">you</span></> : row.name}
      fraction={row.mentions / maxMentions}
      value={`${row.mentions} of ${report.totalChecks}`}
    />
  );

  const siteRow = (site: (typeof sources.sources)[number], rank: number, count: number, max: number) => (
    <BarRow
      key={site.domain}
      rank={rank}
      icon={<SiteIcon domain={site.domain} />}
      label={site.domain}
      highlight={site.kind === "own_site"}
      fill={KIND_FILL[site.kind]}
      fraction={count / Math.max(1, max)}
      value={`${count} answer${count === 1 ? "" : "s"}`}
    />
  );
  const gaps = sources.gaps.slice(0, GAP_LIMIT);
  const topSites = sources.sources.slice(0, SOURCE_LIMIT);

  return (
    <PageBody>
      <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="competitors" />
      {locked && (
        <div className="mb-4">
          <OneTimeAuditCard slug={slug} scanDate={latestScan.startedAt}>
            Competitors move every week. A plan tracks them weekly, so you see when you pass them, and when a new one shows up.
          </OneTimeAuditCard>
        </div>
      )}

      <div className="space-y-4">
        {!nobodyNamed && (
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <Tile value={`#${ownRank + 1}`} label={`your rank of ${report.shareOfVoice.length} named`} color="text-gold" />
            <Tile value={ahead} label="named more than you" color="text-ring-facts" />
            <Tile value={behind} label="named less than you" color="text-teal" />
          </div>
        )}

        <Card title="Who AI names most" aside={<span className="text-[13px] text-muted">Out of {report.totalChecks} answers</span>}>
          {nobodyNamed ? (
            <Note>No businesses were named in the latest scan.</Note>
          ) : (
            <>
              <ol className="space-y-3">{leaders.map((row, i) => shareRow(row, i + 1))}</ol>
              {tail.length > 0 && (
                <details className="mt-4">
                  <summary className={FOLD}>{tail.length} more</summary>
                  <ol className="mt-3 space-y-3">{tail.map((row, i) => shareRow(row, visibleCount + i + 1))}</ol>
                </details>
              )}
            </>
          )}
        </Card>

        {report.rows.length > 0 && (
        <Card title="Question by question" aside={
          <span className="flex items-center gap-3 text-[13px] text-muted">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-teal" />Named you</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-bone" />Left you out</span>
          </span>
        }>
          <div className="divide-y divide-line">
            {report.rows.map(row => (
              <details key={row.promptText} className="py-3">
                <summary className="cursor-pointer text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
                  <span className="ml-1 inline-flex w-[calc(100%-1.5rem)] items-center justify-between gap-x-4 align-top">
                    <span className="min-w-0 text-[15px] font-semibold text-ink">{row.promptText}</span>
                    <span className="flex shrink-0 items-center gap-2.5">
                      {report.engines.filter(e => row.cells[e]).map(engine => {
                        const named = (row.cells[engine]?.practiceIndex ?? -1) >= 0;
                        return (
                          <span key={engine} className="flex items-center gap-1" role="img"
                            aria-label={`${ENGINE_NAMES[engine]} ${named ? "named you" : "left you out"}`}>
                            <SiteIcon domain={TOOL[engine].site} size={16} />
                            <span className={`h-3 w-3 rounded-full ${named ? "bg-teal" : "bg-bone"}`} />
                          </span>
                        );
                      })}
                    </span>
                  </span>
                </summary>
                <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                  {report.engines.map(engine => (
                    <div key={engine}>
                      <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft">
                        <SiteIcon domain={TOOL[engine].site} size={16} />{ENGINE_NAMES[engine]}
                      </p>
                      <NamedList cell={row.cells[engine]} markOf={markOf} />
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </Card>
        )}

        {latestScan.aiOverviews && latestScan.aiOverviews.asked > 0 && (
          <Card title="Google AI Overviews">
            <Note>
              Google showed an AI Overview for {latestScan.aiOverviews.shown} of {latestScan.aiOverviews.asked} customer
              questions and named you in {latestScan.aiOverviews.namedIn}. This is not part of your score.
            </Note>
          </Card>
        )}

        <SectionTitle id="sources" title="Where AI gets its answers" />

        {sources.answersWithSources === 0 ? (
          <Card><Note>No answer in the latest scan listed a website.</Note></Card>
        ) : (
          <>
            <Card title="Kinds of website" aside={<span className="text-[13px] text-muted">{sources.answersWithSources} of {sources.totalAnswers} answers listed theirs</span>}>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
                <div className="shrink-0">
                  <span className="block text-[40px] font-semibold leading-none tracking-tight text-gold">{Math.round(sources.ownSiteRate * 100)}%</span>
                  <span className="mt-1.5 block text-[14px] text-muted">read your website</span>
                </div>
                <div className="min-w-[240px] flex-1">
                  <SplitBar
                    label="Kinds of website AI read"
                    unit="answers"
                    parts={sources.kindMix.map(k => ({ key: k.kind, label: SOURCE_KIND_LABELS[k.kind], value: k.answers, fill: KIND_FILL[k.kind] }))}
                  />
                </div>
              </div>
            </Card>

            <Card title="Where competitors are winning" aside={<span className="text-[13px] text-muted">Read when AI picked a competitor, not you</span>}>
              {gaps.length === 0 ? (
                <p className="text-[15px] font-semibold text-ok">None in this scan. Every time a competitor was recommended, you were too.</p>
              ) : (
                <ol className="space-y-3">{gaps.map((site, i) => siteRow(site, i + 1, site.competitorOnly, gaps[0].competitorOnly))}</ol>
              )}
            </Card>

            <Card title="Most-read websites">
              <ol className="space-y-3">{topSites.map((site, i) => siteRow(site, i + 1, site.answers, topSites[0].answers))}</ol>
              {sources.sources.length > SOURCE_LIMIT && (
                <details className="mt-4">
                  <summary className={FOLD}>{sources.sources.length - SOURCE_LIMIT} more</summary>
                  <ol className="mt-3 space-y-3">
                    {sources.sources.slice(SOURCE_LIMIT).map((site, i) => siteRow(site, SOURCE_LIMIT + i + 1, site.answers, topSites[0].answers))}
                  </ol>
                </details>
              )}
            </Card>
          </>
        )}

        {searches.answersWithSearches > 0 && (
          <Card title="What AI searched for" aside={<span className="text-[13px] text-muted">About {searches.searchesPerAnswer.toFixed(1)} searches per question</span>}>
            {searches.addedWords.length > 0 && (
              <>
                <p className="mb-2 text-[13px] font-medium text-muted">Words AI added most</p>
                <ul className="mb-5 flex flex-wrap gap-2">
                  {searches.addedWords.slice(0, 8).map(w => (
                    <li key={w.word} className="rounded-full border border-gold/30 bg-gold-soft/60 px-3 py-1 text-[14px] font-medium text-ink">{w.word}</li>
                  ))}
                </ul>
              </>
            )}
            <Table
              head={["Search", "AI tools", "Answers"]}
              right={[2]}
              rows={searches.queries.slice(0, SEARCH_LIMIT).map(q => [
                q.query,
                <span key="tools" className="flex items-center gap-1.5">
                  {q.engines.filter((e): e is Engine => (ENGINES as string[]).includes(e)).map(e => (
                    <span key={e} title={ENGINE_NAMES[e]}><SiteIcon domain={TOOL[e].site} size={16} /></span>
                  ))}
                </span>,
                q.answers,
              ])}
            />
          </Card>
        )}
      </div>
    </PageBody>
  );
}
