import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { competitors, facts, practices, prompts } from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import { setDashboardUnlocked, setPracticeActive } from "@/app/admin/actions";
import { getChecksForScan, getFindingsForPractice, getLatestScan } from "@/lib/queries";
import { getPracticeLogins, getScanHistory, getSupportForPractice, getWorkLog } from "@/lib/admin-queries";
import type { Engine } from "@/core/types";
import { displayScores } from "@/core/scoring";
import { PageBody } from "@/components/ui";
import { Button, PrimaryLink, SecondaryLink, Tabs } from "@/app/admin/ui";
import { BusinessHeader } from "../business-header";
import { AccountTab, EmailsTab, LogTab, ReportsTab, ScoresTab, SetupTab, SupportTab } from "./sections";
import { AnswersTab, WrongFactsTab, type FactFilter } from "./answers";

const TABS = [
  { key: "account", label: "Account" },
  { key: "scores", label: "Scores" },
  { key: "reports", label: "Reports" },
  { key: "answers", label: "AI answers" },
  { key: "facts", label: "Wrong facts" },
  { key: "setup", label: "Setup" },
  { key: "emails", label: "Emails" },
  { key: "support", label: "Support" },
  { key: "log", label: "Work log" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const FILTERS: FactFilter[] = ["open", "not_seen", "fixed", "dismissed", "all"];

/**
 * Everything about one customer on one page, for the operator: what they see
 * (scores, reports, answers, wrong facts) and what only we see (every scan
 * attempt, diagnostics, logins). Read-only; editing stays on the business page.
 */
export default async function CustomerOverviewPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; filter?: string }>;
}) {
  await requireOperator();
  const { id } = await params;
  const sp = await searchParams;
  const tab: TabKey = TABS.find(t => t.key === sp.tab)?.key ?? "account";
  const filter: FactFilter = FILTERS.find(f => f === sp.filter) ?? "open";

  const db = getDb();
  const [practice] = await db.select().from(practices).where(eq(practices.id, id));
  if (!practice) notFound();

  const [latest, history, logins, support, findingRows, factRows, promptRows, competitorRows, workLog, diagnostics] = await Promise.all([
    getLatestScan(db, id),
    getScanHistory(db, id),
    getPracticeLogins(db, id),
    getSupportForPractice(db, id),
    getFindingsForPractice(db, id),
    db.select().from(facts).where(eq(facts.practiceId, id)),
    db.select().from(prompts).where(and(eq(prompts.practiceId, id), eq(prompts.active, true))),
    db.select().from(competitors).where(and(eq(competitors.practiceId, id), eq(competitors.status, "active"))),
    getWorkLog(db, id, "client"),
    getWorkLog(db, id, "internal"),
  ]);
  const checks = latest ? await getChecksForScan(db, latest.id) : [];

  // Wrong facts, sorted into the groups the chips filter by.
  const labelOf = new Map(factRows.map(f => [f.id, f.label]));
  const wrongFacts = findingRows.map(f => ({
    id: f.id,
    field: (f.factId && labelOf.get(f.factId)) || "Not on the fact sheet",
    said: f.claim,
    correct: f.factValue ?? "Nothing on the fact sheet backs this up",
    engine: f.engine as Engine,
    createdAt: f.createdAt,
    group: (f.status === "dismissed" ? "dismissed"
      : f.status === "fixed" || f.status === "verified" ? "fixed"
      : latest && f.lastSeenScanId !== latest.id ? "not_seen" : "open") as Exclude<FactFilter, "all">,
  }));
  const openWrong = wrongFacts.filter(f => f.group === "open").length;
  const openSupport = support.filter(r => r.status === "open").length;

  // Latest answers: the first run of each question, every tool, plus the
  // tools that didn't answer it.
  const expectedEngines = (latest?.coverage?.engines ?? []).map(e => e.engine);
  const byPrompt = new Map<string, { prompt: string; kind: string; answers: { engine: Engine; answerText: string; position: string; citations: string[]; toneReason: string | null }[] }>();
  for (const c of checks.filter(c => c.run === 1)) {
    const q = byPrompt.get(c.promptId) ?? { prompt: c.promptText, kind: c.promptKind, answers: [] };
    q.answers.push({ engine: c.engine, answerText: c.answerText, position: c.position, citations: c.citations, toneReason: c.toneReason });
    byPrompt.set(c.promptId, q);
  }
  const questions = [...byPrompt.values()].map(q => ({
    ...q, missing: expectedEngines.filter(e => !q.answers.some(a => a.engine === e)),
  }));

  const counts: Partial<Record<TabKey, number>> = {
    scores: history.length, answers: questions.length, facts: openWrong, support: openSupport, reports: latest ? 5 : 0,
  };
  const base = `/admin/practices/${id}/overview`;

  return (
    <PageBody wide>
      <BusinessHeader
        name={practice.name}
        active={practice.active}
        details={[practice.category, practice.location, practice.website].filter(Boolean).join(" · ") || "No details yet"}
        actions={<>
          {/* Two separate switches. Weekly scans cost money every week; the
              dashboard lock decides what the owner can see. A business on
              weekly scans always has the whole dashboard, so the lock switch
              only shows while scans are off (a prospect, before or after
              their call). */}
          {!practice.active && (
            <form action={setDashboardUnlocked.bind(null, id, !practice.dashboardUnlocked)}>
              <Button variant="outline" size="sm">{practice.dashboardUnlocked ? "Lock dashboard to summary" : "Unlock full dashboard"}</Button>
            </form>
          )}
          <form action={setPracticeActive.bind(null, id, !practice.active)}>
            <Button variant="outline" size="sm">{practice.active ? "Stop weekly scans" : "Start weekly scans"}</Button>
          </form>
          <PrimaryLink href={`/dashboard/${practice.slug}`}>View as customer</PrimaryLink>
          <SecondaryLink href={`/admin/practices/${id}`}>Edit setup</SecondaryLink>
        </>}
      >
        <Tabs label="Customer overview sections" current={tab}
          items={TABS.map(t => ({ ...t, href: `${base}?tab=${t.key}`, count: counts[t.key] }))} />
      </BusinessHeader>

      {tab === "account" && (
        <AccountTab practice={practice} openWrongFacts={openWrong} openSupport={openSupport} logins={logins}
          latest={latest ? { startedAt: latest.startedAt, coverage: latest.coverage, shown: displayScores(latest) } : null} />
      )}
      {tab === "scores" && <ScoresTab scans={history.map(s => ({ ...s, shown: displayScores(s) }))} />}
      {tab === "reports" && <ReportsTab slug={practice.slug} latestDate={latest?.startedAt ?? null} />}
      {tab === "answers" && <AnswersTab date={latest?.startedAt ?? null} questions={questions} />}
      {tab === "facts" && <WrongFactsTab base={base} filter={filter} findings={wrongFacts} practiceId={id} />}
      {tab === "setup" && (
        <SetupTab practiceId={id}
          facts={factRows.filter(f => f.status === "active").map(f => ({ label: f.label, value: f.value }))}
          questions={promptRows.map(p => p.text)}
          competitors={competitorRows.map(c => c.name)} />
      )}
      {tab === "emails" && <EmailsTab />}
      {tab === "support" && <SupportTab requests={support} />}
      {tab === "log" && <LogTab workLog={workLog} diagnostics={diagnostics} />}
    </PageBody>
  );
}
