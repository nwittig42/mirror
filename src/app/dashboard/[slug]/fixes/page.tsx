import Link from "next/link";
import { requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import { getFindingsForPractice, getLatestScan, priceFirst } from "@/lib/queries";
import { DashboardHeader } from "@/components/dashboard-header";
import { LockedSection } from "@/components/locked";
import { FixCard } from "@/components/fix-card";
import { Card, Note, PageBody, SectionTitle, buttonClass } from "@/components/ui";
import { FIX_STATES, fixAdvice, fixProgress, fixState, supersededIds, type FixState } from "@/core/fix-list";

const SECTION: Record<Exclude<FixState, "dismissed">, { title: string; note: string }> = {
  todo: { title: "To do", note: "Prices and serious mistakes first." },
  in_progress: { title: "In progress", note: "Someone is working on these now." },
  fixed: { title: "Fixed, waiting for the next scan", note: "The source has been corrected. The next scan checks that AI has stopped saying it." },
  confirmed: { title: "Confirmed fixed", note: "A scan since the fix did not find these again." },
};

/**
 * The customer's fix list: every wrong fact as a piece of work, with where AI
 * read it, what to change and how far the fix has got. Facts we ruled "not
 * actually wrong" are left out. A prospect before their call gets the locked
 * card and no data, like every section that rests on confirmed facts.
 */
export default async function FixListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { practice, locked } = await requirePracticeView(slug);
  if (locked) {
    return (
      <PageBody>
        <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="fixes" />
        <LockedSection
          title="Wrong facts"
          what="Every wrong fact AI states about you, where it read it, what to change, and whether it has been fixed."
        />
      </PageBody>
    );
  }

  const db = getDb();
  const [all, latestScan] = await Promise.all([getFindingsForPractice(db, practice.id), getLatestScan(db, practice.id)]);
  const stale = supersededIds(all);
  const rows = all.filter(f => f.status !== "dismissed" && !stale.has(f.id)).map(f => ({ ...f, state: fixState(f) }));
  const progress = fixProgress(rows.map(r => r.state));

  return (
    <PageBody>
      <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="fixes" />

      <div className="space-y-4">
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
