import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { competitors, facts, practices, prompts } from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import { getChecksForScan, getFindingsForPractice, getLatestScan } from "@/lib/queries";
import { getPracticeLogins, getScanHistory, getSupportForPractice, getWorkLog } from "@/lib/admin-queries";
import type { Engine } from "@/core/types";
import { displayScores } from "@/core/scoring";
import { ACCENT, ACCENT_TEXT, BackToAdmin, Pill, PrimaryLink, SecondaryLink } from "@/app/admin/ui";
import {
  AccountTab, AnswersTab, EmailsTab, LogTab, ReportsTab, ScoresTab, SetupTab, SupportTab, WrongFactsTab,
  type FactFilter,
} from "./sections";

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
 * attempt, diagnostics, logins). Read-only; editing stays on the practice page.
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
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1000px] px-5 pb-20 pt-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500">
          <div>
            <Link href="/admin" className="hover:text-black" style={{ color: ACCENT_TEXT }}>Admin</Link>
            <span className="mx-1.5">/</span><span className="text-black">{practice.name}</span>
          </div>
          <BackToAdmin />
        </div>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[26px] font-bold tracking-tight text-black">{practice.name}</h1>
              {practice.active ? <Pill tone="green">Active</Pill> : <Pill tone="gray">Paused</Pill>}
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              {[practice.category, practice.location, practice.website].filter(Boolean).join(" · ") || "No details yet"}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrimaryLink href={`/dashboard/${practice.slug}`}>View as customer</PrimaryLink>
            <SecondaryLink href={`/admin/practices/${id}`}>Edit setup ↗</SecondaryLink>
          </div>
        </div>

        <nav className="mb-7 flex overflow-x-auto border-b border-[#e4e4e7]">
          {TABS.map(t => {
            const active = t.key === tab;
            return (
              <Link key={t.key} href={`${base}?tab=${t.key}`}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm ${active ? "font-semibold" : "border-transparent text-[#555] hover:text-black"}`}
                style={active ? { borderColor: ACCENT, color: ACCENT_TEXT } : undefined}>
                {t.label}
                {counts[t.key] !== undefined && <span className="ml-1.5 text-xs text-zinc-400">{counts[t.key]}</span>}
              </Link>
            );
          })}
        </nav>

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
      </div>
    </div>
  );
}
