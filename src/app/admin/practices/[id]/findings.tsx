import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { practices } from "@/db/schema";
import { updateFix } from "@/app/admin/actions";
import { getFindingsForPractice, getLatestScan, priceFirst } from "@/lib/queries";
import { Card, Note, Tag } from "@/components/ui";
import { FixCard } from "@/components/fix-card";
import { Button, Empty, Select, TextInput } from "@/app/admin/ui";
import {
  FIX_STATES, FIX_STATE_LABEL, fixAdvice, fixProgress, fixState, supersededIds, type FixState,
} from "@/core/fix-list";

const ALL_STATES: FixState[] = [...FIX_STATES, "dismissed"];

async function handleUpdateFix(findingId: string, formData: FormData): Promise<void> {
  "use server";
  const state = formData.get("state");
  const note = formData.get("note");
  if (typeof state !== "string" || !(ALL_STATES as string[]).includes(state)) return;
  await updateFix(findingId, { state: state as FixState, note: typeof note === "string" ? note : undefined });
}

/**
 * The fix list as the operator works it: every wrong fact with where AI read
 * it and what to change, plus the two things the customer sees move, its
 * state and a note. "Not actually wrong" takes a fact off the customer's list
 * and stops the scan raising it again.
 */
export async function Findings({ practiceId }: { practiceId: string }) {
  const db = getDb();
  const [[practice], all, latestScan] = await Promise.all([
    db.select({ website: practices.website }).from(practices).where(eq(practices.id, practiceId)),
    getFindingsForPractice(db, practiceId),
    getLatestScan(db, practiceId),
  ]);
  const stale = supersededIds(all);
  const rows = all.filter(f => !stale.has(f.id)).map(f => ({ ...f, state: fixState(f) }));
  const progress = fixProgress(rows.map(r => r.state));
  const open = progress.todo + progress.inProgress;

  return (
    <div id="findings" className="scroll-mt-6">
      <Card title="Wrong facts" aside={open > 0 ? <Tag tone="flag">{open} open</Tag> : undefined}>
        <p className="text-[17px] font-semibold text-ink">{progress.sentence}</p>
        <Note className="mt-1">
          The customer sees this list, each state and each note. Mark a fact fixed once the source is corrected; the next scan
          confirms it by itself when AI stops saying it.
        </Note>

        {rows.length === 0 ? <div className="mt-4"><Empty>Nothing AI said contradicts the fact sheet.</Empty></div> : (
          <div className="mt-5 space-y-6">
            {ALL_STATES.map(state => {
              const inState = rows.filter(r => r.state === state);
              if (inState.length === 0) return null;
              const ordered = state === "todo" ? priceFirst(inState) : inState;
              const cards = (
                <div className="space-y-3">
                  {ordered.map(f => {
                    const fix = fixAdvice(f.citations ?? [], practice?.website ?? null);
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
                      >
                        <form action={handleUpdateFix.bind(null, f.id)} className="mt-4 grid grid-cols-1 gap-2 border-t border-line pt-4 sm:grid-cols-[230px_1fr_auto]">
                          <Select name="state" defaultValue={f.state} aria-label="State">
                            {ALL_STATES.map(s => <option key={s} value={s}>{FIX_STATE_LABEL[s]}</option>)}
                          </Select>
                          <TextInput name="note" defaultValue={f.note ?? ""} maxLength={300}
                            placeholder="Note the customer sees, e.g. Emailed Yelp on Oct 14" aria-label="Note the customer sees" />
                          <Button variant="outline" size="sm">Save</Button>
                        </form>
                      </FixCard>
                    );
                  })}
                </div>
              );
              return (
                <section key={state}>
                  <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
                    {FIX_STATE_LABEL[state]} ({inState.length})
                  </h3>
                  {state === "confirmed" || state === "dismissed" ? (
                    <details>
                      <summary className="cursor-pointer text-[15px] font-semibold text-ink">Show {inState.length}</summary>
                      <div className="mt-3">{cards}</div>
                    </details>
                  ) : cards}
                </section>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
