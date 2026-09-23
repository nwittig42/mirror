import Link from "next/link";
import { requirePracticeAccess } from "@/lib/auth";
import { getDb } from "@/db";
import {
  getLatestScan, getScoreTrend, getOpenFindings, getActivities, getCompetitorPressure, getChecksForScan,
} from "@/lib/queries";
import { DashboardHeader } from "@/components/dashboard-header";
import { ScoreCard } from "@/components/score-card";
import { TrendChart } from "@/components/trend-chart";

interface Activity {
  id: string;
  description: string;
  createdAt: Date;
}

function ActivityList({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Nothing logged yet. Your first week&apos;s work will show up here.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {activities.map(a => (
        <li key={a.id} className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className="text-zinc-400 dark:text-zinc-500">
            {a.createdAt.toISOString().slice(0, 16).replace("T", " ")}
          </span>{" "}
          · {a.description}
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const practice = await requirePracticeAccess(slug);
  const db = getDb();

  const latestScan = await getLatestScan(db, practice.id);

  if (!latestScan) {
    const activities = await getActivities(db, practice.id, 5);
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <DashboardHeader slug={slug} practiceName={practice.name} active="overview" />
        <div className="rounded-lg border border-zinc-200 p-8 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your first scan is running. Check back soon.
          </p>
        </div>
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-medium text-black dark:text-zinc-50">What we&apos;ve done</h2>
          <ActivityList activities={activities} />
        </section>
      </div>
    );
  }

  const [trend, openFindings, competitorPressure, activities, checks] = await Promise.all([
    getScoreTrend(db, practice.id, 12),
    getOpenFindings(db, practice.id),
    getCompetitorPressure(db, latestScan.id),
    getActivities(db, practice.id, 5),
    getChecksForScan(db, latestScan.id),
  ]);

  const total = checks.length;
  const cited = checks.filter(c => c.mentioned).length;
  const delta = trend.length >= 2 ? trend[trend.length - 1].score - trend[trend.length - 2].score : null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <DashboardHeader slug={slug} practiceName={practice.name} active="overview" />

      <p className="mb-8 text-lg text-black dark:text-zinc-50">
        AI engines named {practice.name} in {cited} of {total} checks this week.
      </p>

      <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ScoreCard label="Score" value={latestScan.score ?? 0} delta={delta} />
        <ScoreCard label="This week's cited checks" value={`${cited}/${total}`} />
        <ScoreCard label="Open accuracy issues" value={openFindings.length} />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-black dark:text-zinc-50">Score trend</h2>
        <TrendChart data={trend} />
      </section>

      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Competitor pressure</h2>
          <Link
            href={`/dashboard/${slug}/competitors`}
            className="text-xs text-zinc-500 underline-offset-2 hover:text-black hover:underline dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            See the full comparison
          </Link>
        </div>
        {competitorPressure.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No competitors mentioned in the latest scan.</p>
        ) : (
          <ul className="space-y-2">
            {competitorPressure.map(c => (
              <li key={c.name} className="flex items-center justify-between text-sm">
                <span className="text-black dark:text-zinc-50">{c.name}</span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {c.mentions} mention{c.mentions === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-black dark:text-zinc-50">What we&apos;ve done</h2>
        <ActivityList activities={activities} />
      </section>
    </div>
  );
}
