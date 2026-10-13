import { requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import {
  getLatestScan, getScoreHistory, getOpenFindings, getActivities, getCompetitorPressure, getChecksForScan,
} from "@/lib/queries";
import { DashboardHeader } from "@/components/dashboard-header";
import { ScoreRings } from "@/components/score-rings";
import { BigValue, Card, HistoryBars, METRIC_COLOR, TrendRow } from "@/components/fitness";
import { displayScores, explainOverall, scoreTrend } from "@/core/scoring";
import { ENGINE_NAMES, coverageLabel } from "@/core/coverage";
import { BookCallButton } from "@/components/locked";
import { PreviewSummary } from "./preview-summary";

function WorkLog({ activities }: { activities: { id: string; description: string; createdAt: Date }[] }) {
  if (activities.length === 0) {
    return <p className="text-[15px] text-[#8e8e93]">Nothing logged yet. Your first week&apos;s work shows up here.</p>;
  }
  return (
    <ul className="divide-y divide-[#2c2c2e]">
      {activities.map(a => (
        <li key={a.id} className="flex items-baseline justify-between gap-4 py-2.5">
          <span className="text-[15px] text-white">{a.description}</span>
          <span className="shrink-0 text-[13px] text-[#8e8e93]">
            {a.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The customer's Summary, after Apple Fitness: rings first, then what moved and why. */
export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { practice, locked } = await requirePracticeView(slug);
  const db = getDb();
  const latestScan = await getLatestScan(db, practice.id);

  if (!latestScan) {
    const activities = await getActivities(db, practice.id, 5);
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <DashboardHeader slug={slug} practiceName={practice.name} active="overview" />
        <div className="space-y-4">
          <Card title="Scores">
            <div className="flex items-center gap-5">
              <ScoreRings scores={{ overall: null, facts: null, visibility: null }} size={120} />
              <p className="text-[15px] text-[#aeaeb2]">Your first scan is running. Your scores fill in here when it finishes.</p>
            </div>
          </Card>
          <Card title="What we're working on"><WorkLog activities={activities} /></Card>
        </div>
      </div>
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
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <DashboardHeader slug={slug} practiceName={practice.name} active="overview" />
        <PreviewSummary
          slug={slug}
          ranking={displayScores(latestScan).visibility}
          scanDate={latestScan.startedAt}
          checks={checks}
          topCompetitor={competitorPressure[0] ?? null}
          cta={<BookCallButton />}
        />
      </div>
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
  const explanation = shown.estimated ? null : explainOverall({
    visibility: shown.visibility ?? 0, factScore: shown.facts, hasCritical: seenFindings.some(f => f.severity === "critical"),
  });
  const coverage = coverageLabel(latestScan.coverage ?? null);

  const rings = [
    { label: "Overall", value: shown.overall, color: METRIC_COLOR.overall },
    { label: "Fact check", value: shown.facts, color: METRIC_COLOR.facts },
    { label: "Ranking", value: shown.visibility, color: METRIC_COLOR.visibility },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <DashboardHeader slug={slug} practiceName={practice.name} active="overview" />

      <div className="space-y-4">
        <Card title="Scores">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <ScoreRings scores={{ overall: shown.overall, facts: shown.facts, visibility: shown.visibility }} size={176} />
            <div className="space-y-3">
              {rings.map(r => (
                <div key={r.label}>
                  <div className="text-[15px] font-semibold text-white">{r.label}</div>
                  <div className="text-[30px] font-bold leading-none tracking-tight" style={{ color: r.color }}>
                    {r.value ?? "N/A"}<span className="text-[18px]">/100</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {explanation && <p className="mt-4 text-[13px] text-[#8e8e93]">{explanation}</p>}
          {coverage && <p className="mt-1 text-[13px] font-semibold" style={{ color: METRIC_COLOR.warn }}>{coverage}</p>}
          <p className="mt-1 text-[13px] text-[#8e8e93]">
            From the scan on {latestScan.startedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}.
          </p>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card title="Named by AI" color={METRIC_COLOR.visibility} href={`/dashboard/${slug}/answers`}>
            <BigValue value={`${named}/${earned.length}`} unit="answers" />
            <p className="mt-1 text-[13px] text-[#8e8e93]">When buyers asked without using your name</p>
          </Card>
          <Card title="Wrong facts" color={METRIC_COLOR.facts} href={`/dashboard/${slug}/accuracy`}>
            <BigValue value={seenFindings.length} unit={seenFindings.length === 1 ? "fact" : "facts"} />
            <p className="mt-1 text-[13px] text-[#8e8e93]">What AI got wrong in the latest scan</p>
          </Card>
          <Card title="Top competitor" href={`/dashboard/${slug}/competitors`}>
            {topCompetitor ? (
              <>
                <div className="truncate text-[22px] font-bold text-white">{topCompetitor.name}</div>
                <p className="mt-1 text-[13px] text-[#8e8e93]">Named {topCompetitor.mentions} time{topCompetitor.mentions === 1 ? "" : "s"}, you {named}</p>
              </>
            ) : <p className="text-[15px] text-[#8e8e93]">No competitors named in the latest scan.</p>}
          </Card>
          <Card title="Best AI tool" color={METRIC_COLOR.overall} href={`/dashboard/${slug}/answers`}>
            {bestTool ? (
              <>
                <div className="text-[22px] font-bold text-white">{ENGINE_NAMES[bestTool[0] as keyof typeof ENGINE_NAMES] ?? bestTool[0]}</div>
                <p className="mt-1 text-[13px] text-[#8e8e93]">Named you {bestTool[1]} time{bestTool[1] === 1 ? "" : "s"}</p>
              </>
            ) : <p className="text-[15px] text-[#8e8e93]">No AI tool named you yet.</p>}
          </Card>
        </div>

        <Card title="Trends">
          <TrendRow label="Overall" color={METRIC_COLOR.overall} {...scoreTrend(history, "overall")} />
          <TrendRow label="Fact check" color={METRIC_COLOR.facts} {...scoreTrend(history, "facts")} />
          <TrendRow label="Ranking" color={METRIC_COLOR.visibility} {...scoreTrend(history, "visibility")} />
        </Card>

        <Card title="Overall score by scan" color={METRIC_COLOR.overall}>
          <HistoryBars points={history.map(h => ({ date: h.date, value: h.overall }))} color={METRIC_COLOR.overall} />
        </Card>

        <Card title="What we're working on">
          <WorkLog activities={activities} />
        </Card>
      </div>
    </div>
  );
}
