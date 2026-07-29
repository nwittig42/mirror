import { requirePracticeAccess } from "@/lib/auth";
import { getDb } from "@/db";
import { getFindingsForPractice } from "@/lib/queries";
import { DashboardHeader } from "@/components/dashboard-header";
import { FindingCard, type FindingCardStatus } from "@/components/finding-card";

const GROUP_LABELS: Record<FindingCardStatus, string> = {
  open: "Open",
  fixed: "Fixed",
  verified: "Verified",
};

export default async function AccuracyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const practice = await requirePracticeAccess(slug);
  const db = getDb();
  const allFindings = await getFindingsForPractice(db, practice.id);

  const groups: { key: FindingCardStatus; findings: typeof allFindings }[] = (
    ["open", "fixed", "verified"] as const
  ).map(key => ({ key, findings: allFindings.filter(f => f.status === key) }));
  const dismissed = allFindings.filter(f => f.status === "dismissed");

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <DashboardHeader slug={slug} practiceName={practice.name} active="accuracy" />

      {allFindings.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No accuracy issues found — your fact sheet and AI answers agree.
        </p>
      ) : (
        <div className="space-y-10">
          {groups
            .filter(group => group.findings.length > 0)
            .map(group => (
              <section key={group.key}>
                <h2 className="mb-3 text-sm font-medium text-black dark:text-zinc-50">
                  {GROUP_LABELS[group.key]} ({group.findings.length})
                </h2>
                <div className="space-y-4">
                  {group.findings.map(f => (
                    <FindingCard
                      key={f.id}
                      claim={f.claim}
                      factValue={f.factValue}
                      severity={f.severity}
                      status={group.key}
                      engine={f.engine}
                      createdAt={f.createdAt}
                      resolvedAt={f.resolvedAt}
                    />
                  ))}
                </div>
              </section>
            ))}

          {dismissed.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Dismissed ({dismissed.length})
              </h2>
            </section>
          )}
        </div>
      )}

      <footer className="mt-10 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Accuracy issues cap your visibility score at 70 until resolved.
      </footer>
    </div>
  );
}
