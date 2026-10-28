import { eq } from "drizzle-orm";
import { requirePracticeView } from "@/lib/auth";
import { LockedSection, OneTimeAuditCard } from "@/components/locked";
import { getDb } from "@/db";
import { nameVariations } from "@/db/schema";
import { getFindingsForPractice, getLatestScan, getChecksForScan, priceFirst } from "@/lib/queries";
import { DashboardHeader } from "@/components/dashboard-header";
import { AnswerCard } from "@/components/answer-card";
import { FindingCard } from "@/components/finding-card";
import { BarRow, Card, Note, PageBody, ScoreDial, SectionTitle, SiteIcon, SplitBar, Tag } from "@/components/ui";
import { SHOWN_CAP, engineScores, shownScore } from "@/core/scoring";
import { ENGINE_NAMES } from "@/core/coverage";
import { ENGINES, type Engine, type Position } from "@/core/types";
import { buildSourcesReport, domainOf, SOURCE_KIND_LABELS } from "@/core/citations";
import { KIND_FILL, TOOL } from "@/components/chart-keys";

/** How many of the most-read websites the chart at the top shows. */
const TOP_SITES = 8;

/** One answer in the question grid: gold when named near the top, light gold when named lower, pale when left out. */
const SPOT: Record<Position, { fill: string; label: string }> = {
  first: { fill: "bg-gold", label: "named first" },
  top3: { fill: "bg-gold", label: "named in the top 3" },
  mentioned: { fill: "bg-sun", label: "named" },
  absent: { fill: "bg-bone", label: "not named" },
};

/** A big number that jumps to its section. */
function Jump({ href, value, label, color }: { href: string; value: number; label: string; color: string }) {
  return (
    <a href={href} className="block rounded-[14px] border border-line bg-paper px-6 py-5 transition-colors hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
      <span className={`display block text-[40px] leading-none tabular-nums ${color}`}>{value}</span>
      <span className="mt-1.5 block text-[14px] text-muted">{label}</span>
    </a>
  );
}

/**
 * "What AI says": the pictures first (a score for each AI tool, then the
 * websites AI read before answering), then the facts AI got wrong (what it
 * said next to the truth), then every answer word for word, grouped under
 * the question that was asked.
 *
 * A free account (before their call) gets the same page without the fact
 * check: no wrong facts are loaded, and only buyer-question answers are
 * shown, since an answer to a question that names the business can repeat
 * facts nobody has confirmed with them yet.
 */
export default async function AnswersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { practice, locked } = await requirePracticeView(slug);
  const db = getDb();
  const latestScan = await getLatestScan(db, practice.id);

  if (!latestScan) {
    return (
      <PageBody>
        <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="answers" />
        <Card title="What AI says">
          <Note>Your first scan is running. The answers show up here when it finishes.</Note>
        </Card>
      </PageBody>
    );
  }

  const [variationRows, scanChecks, allFindings] = await Promise.all([
    db.select().from(nameVariations).where(eq(nameVariations.practiceId, practice.id)),
    getChecksForScan(db, latestScan.id),
    locked ? [] : getFindingsForPractice(db, practice.id),
  ]);
  const checks = locked ? scanChecks.filter(c => c.promptKind !== "branded") : scanChecks;
  const practiceNames = Array.from(new Set([practice.name, ...variationRows.map(v => v.text)]));

  const open = priceFirst(allFindings.filter(f => f.status === "open"));
  const resolved = allFindings.filter(f => f.status === "fixed" || f.status === "verified");
  // Buyer questions only: questions that name the business name it back every time.
  const earned = checks.filter(c => c.promptKind !== "branded");
  const named = earned.filter(c => c.mentioned).length;

  // One score per AI tool, with the wrong facts it stated in this scan and the website it read most.
  const tools = engineScores(checks).map(tool => {
    const sites = new Map<string, number>();
    for (const c of earned) {
      if (c.engine !== tool.engine) continue;
      for (const d of new Set(c.citations.map(domainOf).filter((x): x is string => x !== null))) sites.set(d, (sites.get(d) ?? 0) + 1);
    }
    return {
      ...tool,
      // On the same 30-100 scale as the Recommended by AI score it breaks down.
      score: shownScore(tool.score)!,
      name: ENGINE_NAMES[tool.engine] ?? tool.engine,
      wrong: open.filter(f => f.engine === tool.engine && f.lastSeenScanId === latestScan.id).length,
      topSite: [...sites.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null,
    };
  });
  const scanned = new Set(tools.map(t => t.engine));
  const notScanned = ENGINES.filter(e => !scanned.has(e));
  const sources = buildSourcesReport(checks, practice.website);
  const topSites = sources.sources.slice(0, TOP_SITES);

  // Buyer questions down the side, AI tools across: one spot per answer.
  const grid = new Map<string, Map<Engine, Position[]>>();
  for (const c of earned) {
    const row = grid.get(c.promptText) ?? new Map<Engine, Position[]>();
    row.set(c.engine, [...(row.get(c.engine) ?? []), c.position]);
    grid.set(c.promptText, row);
  }

  // Answers under the question they answer, in the order the questions were asked.
  const byQuestion = new Map<string, typeof checks>();
  for (const check of checks) byQuestion.set(check.promptText, [...(byQuestion.get(check.promptText) ?? []), check]);

  return (
    <PageBody>
      <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="answers" />

      {locked && (
        <div className="mb-4">
          <OneTimeAuditCard slug={slug} scanDate={latestScan.startedAt}>
            These are AI&apos;s answers from one day. They change every week. A plan asks again every week, so you see the day AI starts naming you.
          </OneTimeAuditCard>
        </div>
      )}

      <div className={`grid gap-3 sm:gap-4 ${locked ? "grid-cols-2" : "grid-cols-3"}`}>
        <Jump href="#by-question" value={named} label={`of ${earned.length} answers named you`} color="text-gold" />
        {!locked && (
          <Jump href="#wrong-facts" value={open.length} label={`wrong fact${open.length === 1 ? "" : "s"} to fix`} color={open.length > 0 ? "text-flag" : "text-ok"} />
        )}
        <Jump href="#answers" value={checks.length} label={`answer${checks.length === 1 ? "" : "s"} to read`} color="text-ink" />
      </div>

      <div className="mt-4 space-y-4">
        {tools.length > 0 && (
          <Card title="Score by AI tool" aside={<span className="text-[13px] text-muted">Out of 100</span>}>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map(tool => (
                <li key={tool.engine} className="flex items-center gap-4">
                  <ScoreDial value={tool.score} label={tool.name} size={96} color={TOOL[tool.engine].stroke} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[17px] font-semibold text-ink">
                      <SiteIcon domain={TOOL[tool.engine].site} />{tool.name}
                    </div>
                    <div className="mt-1 text-[14px] text-muted">Named you {tool.named} of {tool.asked}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {!locked && <Tag tone={tool.wrong > 0 ? "flag" : "ok"}>{tool.wrong} wrong</Tag>}
                      {tool.topSite && (
                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-bone px-2.5 py-1 text-[12px] font-semibold text-ink-soft" title={`The website ${tool.name} read most`}>
                          <SiteIcon domain={tool.topSite} size={14} /><span className="truncate">{tool.topSite}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {notScanned.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <span className="text-[13px] font-medium text-muted">Coming soon</span>
                {notScanned.map(engine => (
                  <span key={engine} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line px-3 py-1 text-[13px] text-muted">
                    <span className="opacity-50 grayscale"><SiteIcon domain={TOOL[engine].site} size={14} /></span>{ENGINE_NAMES[engine]}
                  </span>
                ))}
              </div>
            )}
          </Card>
        )}

        {grid.size > 0 && (
          <Card title="Question by question" aside={
            <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[13px] text-muted">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-gold" />Top 3</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-sun" />Named</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-bone" />Left out</span>
            </span>
          }>
            <div id="by-question" className="scroll-mt-24 overflow-x-auto">
              <table className="w-full text-[15px]">
                <thead>
                  <tr>
                    <th className="pb-3 text-left text-[12.5px] font-medium text-muted">What buyers asked</th>
                    {tools.map(tool => (
                      <th key={tool.engine} className="px-2 pb-3 text-center" aria-label={tool.name}>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-ink-soft">
                          <SiteIcon domain={TOOL[tool.engine].site} size={16} /><span className="hidden sm:inline">{tool.name}</span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...grid.entries()].map(([question, row]) => (
                    <tr key={question}>
                      <td className="max-w-0 py-2.5 pr-4 text-ink-soft"><span className="block truncate" title={question}>{question}</span></td>
                      {tools.map(tool => {
                        const spots = row.get(tool.engine) ?? [];
                        return (
                          <td key={tool.engine} className="w-px whitespace-nowrap px-2 py-2.5 text-center">
                            <span className="inline-flex gap-1" role="img"
                              aria-label={spots.length ? `${tool.name}: ${spots.map(s => SPOT[s].label).join(", ")}` : `${tool.name}: no answer`}>
                              {spots.map((s, i) => <span key={i} className={`h-3.5 w-3.5 rounded-full ${SPOT[s].fill}`} />)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {sources.answersWithSources > 0 && (
          <Card title="Where AI gets its answers" aside={<a href={`/dashboard/${slug}/competitors#sources`} className="text-[13px] font-semibold text-ink underline decoration-gold underline-offset-4 hover:text-gold">See every website</a>}>
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
            <ol className="mt-6 space-y-3">
              {topSites.map((site, i) => (
                <BarRow
                  key={site.domain}
                  rank={i + 1}
                  icon={<SiteIcon domain={site.domain} />}
                  label={site.domain}
                  highlight={site.kind === "own_site"}
                  fill={KIND_FILL[site.kind]}
                  fraction={site.answers / topSites[0].answers}
                  value={`${site.answers} answer${site.answers === 1 ? "" : "s"}`}
                />
              ))}
            </ol>
          </Card>
        )}

        {locked ? (
          <div id="wrong-facts" className="scroll-mt-24">
            <LockedSection title="Wrong facts" what="What AI says about your prices, services and hours that isn't true, and the answers to questions that use your name." />
          </div>
        ) : (
        <>
        <SectionTitle id="wrong-facts" title="Wrong facts">
          What AI said about you that does not match your Fact Sheet.
        </SectionTitle>
        {open.length === 0 ? (
          <Card>
            <Tag tone="ok">Nothing to fix</Tag>
            <Note className="mt-3">AI and your Fact Sheet agree on everything we checked.</Note>
          </Card>
        ) : (
          <>
            {open.map(f => (
              <FindingCard
                key={f.id}
                claim={f.claim}
                factValue={f.factValue}
                severity={f.severity}
                status="open"
                engine={f.engine}
                createdAt={f.createdAt}
                resolvedAt={f.resolvedAt}
                sources={f.citations}
                isPrice={f.factCategory === "pricing"}
                notSeenLately={f.lastSeenScanId !== latestScan.id}
              />
            ))}
            <Note>
              A serious wrong fact seen in the latest scan holds your Overall score at {SHOWN_CAP}. One marked &ldquo;Not seen in the latest scan&rdquo; costs no points right now.
            </Note>
          </>
        )}
        {resolved.length > 0 && (
          <details>
            <summary className="cursor-pointer text-[15px] font-semibold text-ink-soft hover:text-ink">
              {resolved.length} wrong fact{resolved.length === 1 ? "" : "s"} already fixed
            </summary>
            <div className="mt-3 space-y-4">
              {resolved.map(f => (
                <FindingCard
                  key={f.id}
                  claim={f.claim}
                  factValue={f.factValue}
                  severity={f.severity}
                  status={f.status === "verified" ? "verified" : "fixed"}
                  engine={f.engine}
                  createdAt={f.createdAt}
                  resolvedAt={f.resolvedAt}
                  sources={f.citations}
                  isPrice={f.factCategory === "pricing"}
                />
              ))}
            </div>
          </details>
        )}
        </>
        )}

        <SectionTitle id="answers" title="Every answer">
          Word for word, under the question we asked. Your name is marked in gold. Open an AI tool to read its answer.
        </SectionTitle>
        {checks.length === 0 ? (
          <Card><Note>The latest scan has no answers yet. They show up here when it finishes.</Note></Card>
        ) : (
          [...byQuestion.entries()].map(([question, answers]) => {
            const hits = answers.filter(a => a.mentioned).length;
            return (
              <Card key={question}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <h3 className="min-w-0 flex-1 text-[17px] font-semibold leading-snug text-ink">{question}</h3>
                  <Tag tone={hits === 0 ? "neutral" : hits === answers.length ? "ok" : "gold"}>
                    Named in {hits} of {answers.length}
                  </Tag>
                </div>
                <div className="mt-2 divide-y divide-line">
                  {answers.map(check => (
                    <AnswerCard
                      key={check.id}
                      showQuestion={false}
                      promptText={check.promptText}
                      engine={check.engine}
                      position={check.position}
                      answerText={check.answerText}
                      citations={check.citations}
                      practiceNames={practiceNames}
                      searchQueries={check.searchQueries}
                      tone={check.tone}
                      toneReason={check.toneReason}
                      others={check.competitorsMentioned}
                    />
                  ))}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </PageBody>
  );
}
