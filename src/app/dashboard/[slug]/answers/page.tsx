import { eq } from "drizzle-orm";
import { requirePracticeAccess } from "@/lib/auth";
import { getDb } from "@/db";
import { nameVariations } from "@/db/schema";
import { getLatestScan, getChecksForScan } from "@/lib/queries";
import { DashboardHeader } from "@/components/dashboard-header";
import { AnswerCard } from "@/components/answer-card";

export default async function AnswersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const practice = await requirePracticeAccess(slug);
  const db = getDb();

  const latestScan = await getLatestScan(db, practice.id);

  const variationRows = latestScan
    ? await db.select().from(nameVariations).where(eq(nameVariations.practiceId, practice.id))
    : [];
  const practiceNames = Array.from(new Set([practice.name, ...variationRows.map(v => v.text)]));

  const checks = latestScan ? await getChecksForScan(db, latestScan.id) : [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <DashboardHeader slug={slug} practiceName={practice.name} active="answers" />

      {!latestScan ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Your first scan is running. Check back soon.
        </p>
      ) : checks.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No answers recorded for the latest scan.</p>
      ) : (
        <div className="space-y-4">
          {checks.map(check => (
            <AnswerCard
              key={check.id}
              promptText={check.promptText}
              engine={check.engine}
              position={check.position}
              answerText={check.answerText}
              citations={check.citations}
              practiceNames={practiceNames}
            />
          ))}
        </div>
      )}
    </div>
  );
}
