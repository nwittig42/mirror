"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionGroup, ActionItem, Level } from "@/core/action-plan";
import type { TickState } from "./actions";

type Toggle = (prev: TickState, formData: FormData) => Promise<TickState>;

const LEVEL: Record<Level, string> = { low: "Low", medium: "Medium", high: "High" };

/**
 * The action plan's count and its groups, top to bottom, with a box to tick
 * each step off. Each box is its own form posting to the server action, so it
 * ticks without any script; with script the box and the count change at
 * once and settle on what the server saved. Ticked steps stay where they are.
 */
export function PlanList({
  groups, total, ticked, action, readOnlyNote,
}: {
  groups: ActionGroup[];
  total: number;
  ticked: string[];
  action: Toggle;
  /** Set when an admin is viewing: the boxes show but can't be ticked. */
  readOnlyNote?: string;
}) {
  const [done, setDone] = useState(() => new Set(ticked));
  const mark = (key: string, on: boolean) => setDone(prev => {
    if (prev.has(key) === on) return prev;
    const next = new Set(prev);
    if (on) next.add(key); else next.delete(key);
    return next;
  });
  const count = groups.reduce((n, g) => n + g.items.filter(i => done.has(i.key)).length, 0);
  const percent = total ? Math.round((count / total) * 100) : 0;

  return (
    <>
      <div className="mt-7">
        <p className="text-[15px] font-semibold text-ink" aria-live="polite">{count} of {total} done</p>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-bone" role="progressbar" aria-label="Steps done"
          aria-valuemin={0} aria-valuemax={total} aria-valuenow={count}>
          <div className="h-full rounded-full bg-gold transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
        </div>
        {readOnlyNote && <p className="mt-3 text-[13px] text-muted">{readOnlyNote}</p>}
      </div>

      <div className="mt-12 space-y-12">
        {groups.map((g, gi) => (
          <section key={g.key} aria-labelledby={`group-${g.key}`}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-gold">Step group {gi + 1}</p>
            <h2 id={`group-${g.key}`} className="mt-1.5 text-[22px] font-semibold tracking-tight text-ink">{g.title}</h2>
            <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-muted">{g.intro}</p>
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-paper">
              {g.items.map(item => (
                <PlanItem key={item.key} item={item} done={done.has(item.key)} mark={mark} action={action} readOnly={!!readOnlyNote} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function PlanItem({ item, done, mark, action, readOnly }: {
  item: ActionItem;
  done: boolean;
  mark: (key: string, on: boolean) => void;
  action: Toggle;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { done });
  // Ticked here, this visit: only then does the box play its tick.
  const [fresh, setFresh] = useState(false);
  // Once every tick sent from this box is answered, show what the server saved.
  useEffect(() => {
    if (!pending) mark(item.key, state.done);
    // `mark` is a new function each render; the saved state is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pending, item.key]);
  const quick = item.effort === "low" && item.impact === "high";

  return (
    <li data-done={done} data-key={item.key} className="flex gap-4 px-5 py-5 sm:px-6">
      <form action={formAction} onSubmit={() => { mark(item.key, !done); setFresh(!done); }} className="shrink-0 pt-0.5">
        <input type="hidden" name="key" value={item.key} />
        <input type="hidden" name="done" value={done ? "0" : "1"} />
        <button type="submit" disabled={readOnly} role="checkbox" aria-checked={done}
          aria-label={`${item.title}: ${done ? "done" : "not done"}`} title={done ? "Mark as not done" : "Mark as done"}
          data-fresh={fresh || undefined}
          className={`plan-box flex h-6 w-6 items-center justify-center rounded-[7px] border-2 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-60 ${
            done ? "border-gold bg-gold" : "border-muted bg-transparent hover:border-gold"}`}>
          {done && (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-ivory" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          )}
        </button>
      </form>
      <div className={`min-w-0 flex-1 transition-opacity duration-300 ${done ? "opacity-60" : ""}`}>
        <p className={`text-[16px] font-semibold leading-snug ${done ? "text-muted line-through decoration-muted" : "text-ink"}`}>{item.title}</p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{item.why}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {quick && <span className="rounded-full bg-gold-soft px-2.5 py-0.5 text-[12px] font-semibold text-gold">Quick win</span>}
          <span className="rounded-full border border-line px-2.5 py-0.5 text-[12px] font-medium text-ink-soft">{LEVEL[item.effort]} effort</span>
          <span className="rounded-full border border-line px-2.5 py-0.5 text-[12px] font-medium text-ink-soft">{LEVEL[item.impact]} impact</span>
        </div>
        {(item.how || item.evidence.length > 0) && (
          <details className="group mt-3">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[14px] font-semibold text-gold hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
              How to do it
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 fill-none stroke-current transition-transform group-open:rotate-180" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="mt-2.5 space-y-3 border-l-2 border-gold-soft pl-4">
              {item.how && <p className="text-[15px] leading-relaxed text-ink-soft">{item.how}</p>}
              {item.evidence.length > 0 && (
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">From your scan</p>
                  <ul className="mt-1.5 space-y-1">
                    {item.evidence.map(e => <li key={e} className="text-[14px] leading-relaxed text-ink-soft">{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </details>
        )}
        {state.error && <p className="mt-2 text-[13px] font-semibold text-flag" role="alert">{state.error}</p>}
      </div>
    </li>
  );
}
