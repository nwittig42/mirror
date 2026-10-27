import Link from "next/link";
import { getDb } from "@/db";
import { getFindingsForPractice, priceFirst } from "@/lib/queries";
import { FixCard } from "@/components/fix-card";
import { Card, Note, SectionTitle, buttonClass } from "@/components/ui";
import { FIX_STATES, fixAdvice, fixProgress, fixState, supersededIds, type FixState } from "@/core/fix-list";

const SECTION: Record<Exclude<FixState, "dismissed">, { title: string; note: string }> = {
  todo: { title: "To do", note: "Prices and serious mistakes first." },
  in_progress: { title: "In progress", note: "Someone is working on these now." },
  fixed: { title: "Fixed, waiting for the next scan", note: "The source has been corrected. The next scan checks that AI has stopped saying it." },
  confirmed: { title: "Confirmed fixed", note: "A scan since the fix did not find these again." },
};

/**
 * A paying client's wrong facts, at the foot of the action plan: every wrong
 * fact as a piece of work, with where AI read it, what to change and how far
 * the fix has got. Facts we ruled "not actually wrong" are left out. Never
 * rendered for a free account: the page only calls it when unlocked, so none
 * of this is loaded for them.
 */
export async function WrongFactsSection({ slug, practiceId, website, latestScanId }: {
  slug: string;
  practiceId: string;
  website: string | null;
  /** The latest complete scan, to flag a mistake it no longer saw. */
  latestScanId: string | null;
}) {
  const all = await getFindingsForPractice(getDb(), practiceId);
  const stale = supersededIds(all);
  const rows = all.filter(f => f.status !== "dismissed" && !stale.has(f.id)).map(f => ({ ...f, state: fixState(f) }));
  const progress = fixProgress(rows.map(r => r.state));

  return (
    <div className="mt-16 space-y-4 border-t border-line pt-10">
      <SectionTitle id="wrong-facts" title="Wrong facts">
        What AI said about you that does not match your Fact Sheet, and how far each fix has got.
      </SectionTitle>

      <Card>
        <p className="text-[20px] font-semibold tracking-tight text-ink">{progress.sentence}</p>
        {progress.total > 0 ? (
          <>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-bone" role="img" aria-label={`${progress.percentDone}% fixed`}>
              <div className="h-full rounded-full bg-ok" style={{ width: `${progress.percentDone}%` }} />
            </div>
            <Note className="mt-3">
              Each one below shows where AI read it and what to change. Once a fix is made, the next scan confirms AI has stopped saying it.
            </Note>
          </>
        ) : (
          <Note className="mt-2">
            {latestScanId ? "Nothing AI said in your scans contradicts your Fact Sheet." : "Your first scan is running. Anything AI gets wrong shows up here when it finishes."}
          </Note>
        )}
      </Card>

      {FIX_STATES.map(state => {
        const inState = rows.filter(r => r.state === state);
        if (inState.length === 0) return null;
        const ordered = state === "todo" ? priceFirst(inState) : inState;
        const cards = ordered.map(f => {
          const fix = fixAdvice(f.citations ?? [], website);
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
              notSeenLately={state === "todo" && !!latestScanId && f.lastSeenScanId !== latestScanId}
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
  );
}
