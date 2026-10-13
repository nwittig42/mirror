import { requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import {
  getLatestScan, getScoreHistory, getOpenFindings, getActivities, getCompetitorPressure, getChecksForScan,
} from "@/lib/queries";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, HistoryBars, Note, PageBody, RingLegend, ScoreRings, Stat, TrendRow, type RingScore } from "@/components/ui";
import { displayScores, explainOverall, scoreTrend, shareOfVoice } from "@/core/scoring";
import { ENGINE_NAMES, coverageLabel } from "@/core/coverage";
import { BookCallButton } from "@/components/locked";
import { PreviewSummary } from "./preview-summary";

function WorkLog({ activities }: { activities: { id: string; description: string; createdAt: Date }[] }) {
  if (activities.length === 0) {
    return <Note>Nothing logged yet. Your first week&apos;s work shows up here.</Note>;
  }
  return (
    <ul className="divide-y divide-line">
      {activities.map(a => (
        <li key={a.id} className="flex items-baseline justify-between gap-4 py-2.5">
          <span className="text-[15px] text-ink">{a.description}</span>
          <span className="shrink-0 text-[13px] text-muted">
            {a.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The customer's Overview: the score first, then the four numbers behind it, then what moved. */
export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { practice, locked } = await requirePracticeView(slug);
  const db = getDb();
  const latestScan = await getLatestScan(db, practice.id);

  if (!latestScan) {
    const activities = await getActivities(db, practice.id, 5);
    return (
      <PageBody>
        <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="overview" />
        <div className="space-y-4">
          <Card title="Your score">
            <div className="flex items-center gap-6">
              <ScoreRings size={120} rings={[
                { key: "overall", label: "Overall", value: null },
                { key: "visibility", label: "Recommended by AI", value: null },
                { key: "facts", label: "Accuracy", value: null },
              ]} />
              <Note>Your first scan is running. Your scores fill in here when it finishes.</Note>
            </div>
          </Card>
          <Card title="What we're working on"><WorkLog activities={activities} /></Card>
        </div>
      </PageBody>
    );
  }

  // A prospect before their call: the ranking and nothing that depends on
  // facts nobody has confirmed yet. None of the rest is loaded.
  if (locked) {
    const [competitorPressure, checks] = await Promise.all([
      getCompetitorPressure(db, latestScan.id),
      getChecksForScan(db, latestScan.id),
    ]);
    return (
      <PageBody>
        <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="overview" />
        <PreviewSummary
          slug={slug}
          ranking={displayScores(latestScan).visibility}
          scanDate={latestScan.startedAt}
          checks={checks}
          topCompetitor={competitorPressure[0] ?? null}
          cta={<BookCallButton />}
        />
      </PageBody>
    );
  }

  const [history, openFindings, competitorPressure, activities, checks] = await Promise.all([
    getScoreHistory(db, practice.id, 12),
    getOpenFindings(db, practice.id),
    getCompetitorPressure(db, latestScan.id),
    getActivities(db, practice.id, 5),
    getChecksForScan(db, latestScan.id),
  ]);

  const shown = displayScores(latestScan);
  // Only wrong facts the latest scan repeated count toward its fact score.
  const seenFindings = openFindings.filter(f => f.lastSeenScanId === latestScan.id);
  // Buyer questions only: questions that name the business name it back every time.
  const earned = checks.filter(c => c.promptKind !== "branded");
  const named = earned.filter(c => c.mentioned).length;
  const byTool = new Map<string, number>();
  for (const c of earned) if (c.mentioned) byTool.set(c.engine, (byTool.get(c.engine) ?? 0) + 1);
  const bestTool = [...byTool.entries()].sort((a, b) => b[1] - a[1])[0];
  const topCompetitor = competitorPressure[0];
  const voice = shareOfVoice(checks);
  const explanation = shown.estimated ? null : explainOverall({
    visibility: shown.visibility ?? 0, factScore: shown.facts, hasCritical: seenFindings.some(f => f.severity === "critical"),
  });
  const coverage = coverageLabel(latestScan.coverage ?? null);
  const rings: RingScore[] = [
    { key: "overall", label: "Overall", value: shown.overall, note: "Your two scores combined" },
    { key: "visibility", label: "Recommended by AI", value: shown.visibility, note: "How often and how high AI names you" },
    { key: "facts", label: "Accuracy", value: shown.facts, note: "How much of what AI says about you is true" },
  ];
  const scanDate = latestScan.startedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <PageBody>
      <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="overview" />

      <div className="space-y-4">
        <Card title="Your score" aside={<span className="text-[13px] text-muted">Scan of {scanDate}</span>}>
          <div className="flex flex-wrap items-center gap-x-10 gap-y-6">
            <ScoreRings rings={rings} />
            <div className="min-w-[240px] flex-1">
              <RingLegend rings={rings} />
            </div>
          </div>
          {explanation && <Note className="mt-5">{explanation}</Note>}
          {coverage && <p className="mt-1 text-[14px] font-semibold text-flag">{coverage}</p>}
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card title="Named by AI" href={`/dashboard/${slug}/answers`}>
            <Stat value={named} unit={`of ${earned.length} answers`} tone="gold" />
            <Note className="mt-2">When buyers asked without using your name</Note>
          </Card>
          <Card title="Wrong facts" href={`/dashboard/${slug}/fixes`}>
            <Stat value={seenFindings.length} unit="to fix" tone={seenFindings.length > 0 ? "flag" : "ok"} />
            <Note className="mt-2">What AI got wrong in the latest scan</Note>
          </Card>
          <Card title="Top competitor" href={`/dashboard/${slug}/competitors`}>
            {topCompetitor ? (
              <>
                <div className="truncate text-[24px] font-semibold tracking-tight text-ink">{topCompetitor.name}</div>
                <Note className="mt-2">Named {topCompetitor.mentions} time{topCompetitor.mentions === 1 ? "" : "s"}, you {named}</Note>
              </>
            ) : <Note>No competitors named in the latest scan.</Note>}
          </Card>
          <Card title="Share of mentions" href={`/dashboard/${slug}/competitors`}>
            <Stat value={voice.share === null ? "N/A" : `${voice.share}%`} tone="gold" />
            <Note className="mt-2">
              {voice.share === null
                ? "No business was named in the latest scan."
                : `You were ${voice.yours} of the ${voice.total} times AI named any business`}
              {bestTool ? `. Best AI tool: ${ENGINE_NAMES[bestTool[0] as keyof typeof ENGINE_NAMES] ?? bestTool[0]}.` : "."}
            </Note>
          </Card>
        </div>

        <Card title="Trends">
          <div className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
            <div className="divide-y divide-line">
              <TrendRow label="Overall" {...scoreTrend(history, "overall")} />
              <TrendRow label="Recommended by AI" {...scoreTrend(history, "visibility")} />
              <TrendRow label="Accuracy" {...scoreTrend(history, "facts")} />
            </div>
            <div>
              <p className="mb-3 text-[13px] text-muted">Overall score by scan</p>
              <HistoryBars points={history.map(h => ({ date: h.date, value: h.overall }))} label="Overall score by scan" />
            </div>
          </div>
        </Card>

        <Card title="What we're working on">
          <WorkLog activities={activities} />
        </Card>
      </div>
    </PageBody>
  );
}
