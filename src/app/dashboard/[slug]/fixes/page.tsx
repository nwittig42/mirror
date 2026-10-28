import { eq } from "drizzle-orm";
import { auth, requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import { checks } from "@/db/schema";
import { getLatestScan } from "@/lib/queries";
import { loadActionPlan } from "@/lib/action-plan";
import { ADMIN_READ_ONLY_MESSAGE, isAdminViewer } from "@/lib/admin-view";
import { DashboardHeader } from "@/components/dashboard-header";
import { PageBody, PageTitle } from "@/components/ui";
import { toggleTick } from "./actions";
import { OneTimeAuditCard } from "@/components/locked";
import { PlanList } from "./plan-list";
import { WrongFactsSection } from "./wrong-facts-section";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Next steps: every step from the latest scan that would get the
 * business recommended by AI more often, quick wins first, then every move
 * filterable by group, with a box to tick each off. Built from where AI read and who it named, never from
 * the fact check, so a free account gets all of it. A paying client also gets
 * their wrong facts at the foot, as pieces of work. Still at /fixes, the
 * address the fix plan had, so old links land here. Stored data only, so no
 * longer than the default time limit.
 */
export default async function ActionPlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { practice, locked } = await requirePracticeView(slug);
  const session = await auth();
  const db = getDb();
  const [loaded, scan] = await Promise.all([loadActionPlan(db, practice.id), getLatestScan(db, practice.id)]);
  // A scan with no answers yet has nothing to plan from; its website check alone would read as the whole plan.
  const answered = !!scan && (await db.select({ id: checks.id }).from(checks).where(eq(checks.scanId, scan.id)).limit(1)).length > 0;
  const plan = loaded && answered ? loaded.plan : null;
  // Loaded here, not as a component of its own, so the page renders in one pass. A free account gets none of it.
  const wrongFacts = locked ? null : await WrongFactsSection({
    slug, practiceId: practice.id, website: practice.website, latestScanId: scan?.id ?? null,
  });

  return (
    <PageBody wide>
      <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="fixes" />

      <div>
        <PageTitle
          eyebrow={loaded && plan ? `From your scan of ${loaded.scanDate.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}` : practice.name}
          title="Your next steps"
        />
        {locked && plan && plan.total > 0 && (
          <div className="-mt-2 mb-2">
            <OneTimeAuditCard slug={slug} scanDate={scan?.startedAt ?? null}>
              Your free audit doesn&apos;t scan again, so it can&apos;t tell you which of these steps worked. A plan rescans every week and shows you.
            </OneTimeAuditCard>
          </div>
        )}

        {!plan ? (
          <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-ink-soft">
            Your scan is still running. Your next steps show up here when it finishes.
          </p>
        ) : plan.total === 0 ? (
          <div className="mt-6 rounded-[14px] border border-line bg-paper p-6">
            <p className="text-[18px] font-semibold text-ink">Nothing to do right now</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
              AI named you when buyers asked, and your website gave it nothing to trip over. We look again on the next scan.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-3 text-[18px] leading-relaxed text-ink-soft">
              {plural(plan.total, "step")} to get recommended by AI more often
              {plan.quickWins > 0 && <> · <span className="font-semibold text-teal">{plural(plan.quickWins, "quick win")}</span></>}
            </p>
            <PlanList
              groups={plan.groups}
              total={plan.total}
              ticked={[...loaded!.ticks]}
              action={toggleTick.bind(null, slug)}
              readOnlyNote={isAdminViewer(session?.user?.role) ? ADMIN_READ_ONLY_MESSAGE : undefined}
            />
          </>
        )}

        {wrongFacts}
      </div>
    </PageBody>
  );
}
