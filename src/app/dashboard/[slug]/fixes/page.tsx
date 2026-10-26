import Link from "next/link";
import { requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import { getFindingsForPractice, getLatestScan, priceFirst } from "@/lib/queries";
import { DashboardHeader } from "@/components/dashboard-header";
import { LockedSection } from "@/components/locked";
import { FixCard } from "@/components/fix-card";
import { Card, Note, PageBody, SectionTitle, Tag, buttonClass } from "@/components/ui";
import { FIX_STATES, fixAdvice, fixProgress, fixState, supersededIds, type FixState } from "@/core/fix-list";
import { buildAuditReportData } from "@/report/build-report";
import { actionsFor, levelLabel, quadrant } from "@/report/scoring";
import type { Action } from "@/report/types";

// The first view after a scan may run the website check (a few page loads), as the report viewer does.
export const maxDuration = 60;

const SECTION: Record<Exclude<FixState, "dismissed">, { title: string; note: string }> = {
  todo: { title: "To do", note: "Prices and serious mistakes first." },
  in_progress: { title: "In progress", note: "Someone is working on these now." },
  fixed: { title: "Fixed, waiting for the next scan", note: "The source has been corrected. The next scan checks that AI has stopped saying it." },
  confirmed: { title: "Confirmed fixed", note: "A scan since the fix did not find these again." },
};

/**
 * The recommendations from the latest scan, step by step: the report's
 * actions, most help for the work first. A gold number marks little effort
 * and big impact, as on the report's plan page.
 */
function Recommendations({ actions, answered }: { actions: Action[]; answered: boolean }) {
  return (
    <Card title="Your recommendations">
      {!answered ? (
        <Note>Your scan is still running. Your recommendations show up here when it finishes.</Note>
      ) : actions.length === 0 ? (
        <Note>Nothing urgent in the latest scan. We look again on the next one.</Note>
      ) : (
        <>
          <ol className="divide-y divide-line">
            {actions.map((a, i) => {
              const quick = quadrant(a.effort, a.impact) === "quick_win";
              return (
                <li key={a.id} className="flex gap-4 py-3.5">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-paper ${quick ? "bg-gold" : "bg-ink"}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-semibold leading-snug text-ink">{a.title}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{a.why}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Tag tone={a.effort === "low" ? "ok" : "neutral"}>{levelLabel[a.effort]} effort</Tag>
                      <Tag tone={a.impact === "high" ? "ok" : "neutral"}>{levelLabel[a.impact]} impact</Tag>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <Note className="mt-3">Do them in order. A gold number marks little effort and big impact.</Note>
        </>
      )}
    </Card>
  );
}

/**
 * The fix plan: the recommendations from the latest scan, then every wrong
 * fact as a piece of work, with where AI read it, what to change and how far
 * the fix has got. Facts we ruled "not actually wrong" are left out.
 *
 * A free account (before their call) gets the recommendations that don't
 * rest on the fact check (the same set as the prospect's one-page summary),
 * and the wrong-fact list stays locked: none of it is loaded.
 */
export default async function FixListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { practice, locked } = await requirePracticeView(slug);
  const db = getDb();
  const latestScan = await getLatestScan(db, practice.id);
  const report = latestScan ? await buildAuditReportData(db, practice.id) : null;
  const plan = report && (
    // A scan with no answers yet has nothing to recommend from; its website check alone would read as the whole plan.
    <Recommendations actions={locked ? actionsFor("visibility", report) : report.actions} answered={report.scan.tools.length > 0} />
  );

  if (locked) {
    return (
      <PageBody>
        <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="fixes" />
        <div className="space-y-4">
          {plan ?? (
            <Card title="Your recommendations">
              <Note>Your first scan is running. Your recommendations show up here when it finishes.</Note>
            </Card>
          )}
          <LockedSection
            title="Wrong facts"
            what="Every wrong fact AI states about you, where it read it, what to change, and whether it has been fixed."
          />
        </div>
      </PageBody>
    );
  }

  const all = await getFindingsForPractice(db, practice.id);
  const stale = supersededIds(all);
  const rows = all.filter(f => f.status !== "dismissed" && !stale.has(f.id)).map(f => ({ ...f, state: fixState(f) }));
  const progress = fixProgress(rows.map(r => r.state));

  return (
    <PageBody>
      <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="fixes" />

      <div className="space-y-4">
        {plan}

        <Card title="Wrong facts">
          <p className="text-[22px] font-semibold tracking-tight text-ink">{progress.sentence}</p>
          {progress.total > 0 && (
            <>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-bone" role="img" aria-label={`${progress.percentDone}% fixed`}>
                <div className="h-full rounded-full bg-ok" style={{ width: `${progress.percentDone}%` }} />
              </div>
              <Note className="mt-3">
                A wrong fact is one where AI said something that does not match your Fact Sheet. Each one below shows where AI read
                it and what to change. Once a fix is made, the next scan confirms AI has stopped saying it.
              </Note>
            </>
          )}
          {progress.total === 0 && (
            <Note className="mt-2">
              {latestScan ? "Nothing AI said in your scans contradicts your Fact Sheet." : "Your first scan is running. Anything AI gets wrong shows up here when it finishes."}
            </Note>
          )}
        </Card>

        {FIX_STATES.map(state => {
          const inState = rows.filter(r => r.state === state);
          if (inState.length === 0) return null;
          const ordered = state === "todo" ? priceFirst(inState) : inState;
          const cards = ordered.map(f => {
            const fix = fixAdvice(f.citations ?? [], practice.website);
            return (
              <FixCard
                key={f.id}
                topic={f.factLabel}
                claim={f.claim}
                truth={f.factValue}
                severity={f.severity}
                isPrice={f.factCategory === "pricing"}
                engine={f.engine}
                state={f.state}
                sources={fix.sources}
                advice={fix.advice}
                note={f.note}
                noteUpdatedAt={f.noteUpdatedAt}
                foundAt={f.createdAt}
                fixedAt={f.resolvedAt}
                notSeenLately={state === "todo" && !!latestScan && f.lastSeenScanId !== latestScan.id}
              />
            );
          });
          return (
            <section key={state} className="space-y-3">
              <SectionTitle id={state} title={`${SECTION[state].title} (${inState.length})`}>{SECTION[state].note}</SectionTitle>
              {state === "confirmed" ? (
                <details className="rounded-[20px] border border-line bg-paper p-5">
                  <summary className="cursor-pointer text-[15px] font-semibold text-ink">Show {inState.length} confirmed fix{inState.length === 1 ? "" : "es"}</summary>
                  <div className="mt-4 space-y-3">{cards}</div>
                </details>
              ) : cards}
            </section>
          );
        })}

        {progress.todo + progress.inProgress > 0 && (
          <Card title="Want us to fix these for you?">
            <p className="text-[15px] leading-relaxed text-ink-soft">
              You can work through this list yourself, or we can correct the sources for you: once, for a one-time fee, or every month as a Partner.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/dashboard/${slug}/help`} className={buttonClass("gold")}>Ask us to fix them</Link>
              <Link href="/pricing" className={buttonClass("outline")}>See the plans</Link>
            </div>
          </Card>
        )}
      </div>
    </PageBody>
  );
}
