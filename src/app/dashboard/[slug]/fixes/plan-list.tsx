"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionGroup, ActionItem, GroupKey, Level } from "@/core/action-plan";
import type { GuideStep } from "@/core/move-guides";
import type { TickState } from "./actions";

type Toggle = (prev: TickState, formData: FormData) => Promise<TickState>;
type Mark = (key: string, on: boolean) => void;

// Urgency is the impact: what it costs to leave the step undone.
const URGENCY: Record<Level, { label: string; color: string; soft: string }> = {
  high: { label: "Urgent", color: "#b4412f", soft: "#f6e0db" },
  medium: { label: "Important", color: "#b7791f", soft: "#f7ead0" },
  low: { label: "When you can", color: "#6f7a6c", soft: "#e7ebe4" },
};
// Size is the effort.
const SIZE: Record<Level, string> = { low: "Small task", medium: "Medium task", high: "Big project" };

const isQuick = (i: ActionItem) => i.effort === "low" && i.impact === "high";

/**
 * Next steps: the progress, a "start here" row of quick wins, then every step
 * in a list on the left, coloured by urgency and filterable, with the
 * selected step's timeline, upside and step-by-step guide on the right (under
 * the step on a phone). Every box is its own form posting to the server
 * action, so it ticks without any script; with script the box and the count
 * change at once and settle on what the server saved.
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
  const mark: Mark = (key, on) => setDone(prev => {
    if (prev.has(key) === on) return prev;
    const next = new Set(prev);
    if (on) next.add(key); else next.delete(key);
    return next;
  });
  const all = groups.flatMap(g => g.items.map(item => ({ item, group: g })));
  const quick = all.filter(r => isQuick(r.item));
  const urgent = all.filter(r => r.item.impact === "high");
  const count = all.filter(r => done.has(r.item.key)).length;
  const percent = total ? Math.round((count / total) * 100) : 0;

  type Filter = "all" | "urgent" | "quick" | GroupKey;
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? all : filter === "urgent" ? urgent : filter === "quick" ? quick : all.filter(r => r.group.key === filter);
  const [selectedKey, setSelectedKey] = useState(() => (quick[0] ?? all[0])?.item.key);
  const selected = shown.find(r => r.item.key === selectedKey) ?? shown[0];
  const readOnly = !!readOnlyNote;
  const open = (key: string) => {
    setFilter("all");
    setSelectedKey(key);
    requestAnimationFrame(() => document.getElementById("every-step")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const tabs: { key: Filter; label: string; n: number; color?: string }[] = [
    { key: "all", label: "All steps", n: all.length },
    ...(urgent.length ? [{ key: "urgent" as const, label: "Urgent", n: urgent.length, color: URGENCY.high.color }] : []),
    ...(quick.length ? [{ key: "quick" as const, label: "Quick wins", n: quick.length }] : []),
    ...groups.map(g => ({ key: g.key, label: g.title, n: g.items.length })),
  ];

  return (
    <>
      <div className="mt-6 grid gap-4 rounded-[18px] border border-line bg-paper p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[18px] font-semibold text-ink" aria-live="polite">{count} of {total} done</p>
            <p className="text-[14px] text-muted">{percent}%</p>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-bone" role="progressbar" aria-label="Steps done"
            aria-valuemin={0} aria-valuemax={total} aria-valuenow={count}>
            <div className="h-full rounded-full bg-ok transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
          </div>
          {readOnlyNote && <p className="mt-3 text-[13px] text-muted">{readOnlyNote}</p>}
        </div>
        <div className="flex flex-wrap gap-2 text-[13px] sm:justify-end">
          {(["high", "medium", "low"] as Level[]).map(l => {
            const n = all.filter(r => r.item.impact === l).length;
            return n ? (
              <span key={l} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold" style={{ color: URGENCY[l].color, background: URGENCY[l].soft }}>
                <span className="h-2 w-2 rounded-full" style={{ background: URGENCY[l].color }} aria-hidden="true" />
                {n} {URGENCY[l].label.toLowerCase()}
              </span>
            ) : null;
          })}
        </div>
      </div>

      {quick.length > 0 && (
        <section className="mt-10" aria-labelledby="start-here">
          <h2 id="start-here" className="text-[26px] font-semibold tracking-tight text-ink">Start here</h2>
          <p className="mt-1 text-[16px] text-ink-soft">
            {quick.length === 1 ? "One quick win: little work, big effect." : `${quick.length} quick wins: little work, big effect. Do these first.`}
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {quick.slice(0, 4).map(({ item }) => (
              <article key={item.key} data-done={done.has(item.key)}
                className={`relative flex flex-col overflow-hidden rounded-[18px] border border-line bg-paper p-5 pl-6 transition-opacity sm:p-6 sm:pl-7 ${done.has(item.key) ? "opacity-60" : ""}`}>
                <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: URGENCY[item.impact].color }} aria-hidden="true" />
                <Labels item={item} />
                <h3 className={`mt-3 text-[19px] font-semibold leading-snug ${done.has(item.key) ? "text-muted line-through" : "text-ink"}`}>{item.title}</h3>
                {item.estimate && <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-soft">{item.estimate.upside}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => open(item.key)}
                    className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[14px] font-semibold text-ivory hover:bg-ink-soft">
                    Step-by-step guide
                    <span aria-hidden="true">→</span>
                  </button>
                  <TickButton item={item} done={done.has(item.key)} mark={mark} action={action} readOnly={readOnly} quiet />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12 scroll-mt-6" id="every-step" aria-labelledby="every-step-title">
        <h2 id="every-step-title" className="text-[26px] font-semibold tracking-tight text-ink">Every step</h2>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter steps">
          {tabs.map(t => (
            <button key={t.key} type="button" role="tab" aria-selected={filter === t.key} onClick={() => setFilter(t.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[14px] font-medium transition-colors ${
                filter === t.key ? "border-ink bg-ink text-ivory" : "border-line bg-paper text-ink-soft hover:border-ink-soft"}`}>
              {t.color && <span className="h-2 w-2 rounded-full" style={{ background: t.color }} aria-hidden="true" />}
              {t.label}
              <span className={`text-[12px] ${filter === t.key ? "text-ivory/70" : "text-muted"}`}>{t.n}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-paper">
            {shown.map(({ item, group }) => {
              const isSel = selected?.item.key === item.key;
              const isDone = done.has(item.key);
              return (
                <li key={item.key} data-done={isDone} data-key={item.key} className={`relative ${isSel ? "bg-ivory" : ""}`}>
                  <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: URGENCY[item.impact].color, opacity: isDone ? 0.35 : 1 }} aria-hidden="true" />
                  <div className="flex gap-3.5 py-4 pl-6 pr-5">
                    <TickBox item={item} done={isDone} mark={mark} action={action} readOnly={readOnly} />
                    <button type="button" onClick={() => setSelectedKey(item.key)} aria-expanded={isSel}
                      className="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
                      <p className={`text-[16px] font-semibold leading-snug ${isDone ? "text-muted line-through decoration-muted" : "text-ink"}`}>{item.title}</p>
                      <div className="mt-2"><Labels item={item} /></div>
                      <p className="mt-1.5 text-[12px] text-muted">{group.title}</p>
                    </button>
                  </div>
                  {/* On a phone the details open under the step itself. */}
                  {isSel && (
                    <div className="border-t border-line px-5 pb-5 pt-4 lg:hidden">
                      <StepDetail item={item} group={group} done={isDone} mark={mark} action={action} readOnly={readOnly} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {selected && (
            <aside className="sticky top-6 hidden max-h-[calc(100vh-3rem)] overflow-y-auto rounded-[18px] border border-line bg-paper p-6 lg:block" aria-label="Step details">
              <StepDetail item={selected.item} group={selected.group} done={done.has(selected.item.key)} mark={mark} action={action} readOnly={readOnly} />
            </aside>
          )}
        </div>
      </section>
    </>
  );
}

/** Urgency, by colour, then the size and time as a separate label. */
function Labels({ item }: { item: ActionItem }) {
  const u = URGENCY[item.impact];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={{ color: u.color, background: u.soft }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: u.color }} aria-hidden="true" />
        {u.label}
      </span>
      <span className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-[12px] font-medium text-ink-soft">
        {item.estimate ? `${sizeOf(item.estimate.time) ?? SIZE[item.effort]} · ${shortTime(item.estimate.time)}` : SIZE[item.effort]}
      </span>
      {isQuick(item) && <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-[12px] font-semibold text-ok">Quick win</span>}
    </div>
  );
}

/** The size from the time it takes, so the two never disagree: up to 30 minutes is small, up to 2 hours medium. */
function sizeOf(time: string): string | null {
  if (/few hours/.test(time)) return "Big project";
  const m = time.match(/(\d+)(?: to (\d+))?\s*(minutes?|hours?)/);
  if (!m) return null;
  const most = Number(m[2] ?? m[1]) * (m[3].startsWith("hour") ? 60 : 1);
  return most <= 30 ? "Small task" : most <= 120 ? "Medium task" : "Big project";
}

/** "About 45 minutes, plus a few days to verify" → "45 min". */
function shortTime(time: string): string {
  const m = time.match(/(\d+(?: to \d+)?)\s*(minutes?|hours?)/);
  if (m) return `${m[1].replace(" to ", "–")} ${m[2].startsWith("min") ? "min" : m[1] === "1" ? "hour" : "hours"}`;
  return /few hours/.test(time) ? "a few hours" : time;
}

function StepDetail({ item, group, done, mark, action, readOnly }: {
  item: ActionItem; group: ActionGroup; done: boolean; mark: Mark; action: Toggle; readOnly: boolean;
}) {
  const u = URGENCY[item.impact];
  // The guide links the pages AI read, so the proof keeps only what it doesn't: the questions and quotes.
  const proof = item.guide?.length ? item.evidence.filter(e => !/^https?:\/\//.test(e)) : item.evidence;
  return (
    <div>
      <Labels item={item} />
      <h3 className="mt-3 text-[24px] font-semibold leading-snug tracking-tight text-ink">{item.title}</h3>
      <p className="mt-1 text-[13px] text-muted">{group.title}</p>

      {item.estimate && (
        <div className="mt-5 grid gap-px overflow-hidden rounded-[14px] border border-line bg-line sm:grid-cols-3">
          <Tile label="Time to do" value={item.estimate.time} />
          <Tile label="When AI notices" value={item.estimate.showsUp} />
          <Tile label="Urgency" value={u.label} color={u.color} />
        </div>
      )}
      {item.estimate && (
        <div className="mt-4 rounded-[14px] p-4" style={{ background: u.soft }}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: u.color }}>What it could win</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{item.estimate.upside}</p>
        </div>
      )}

      <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Why it matters</p>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{item.why}</p>

      {item.guide?.length ? (
        <Guide stepKey={item.key} steps={item.guide} />
      ) : item.how ? (
        <div className="mt-5 rounded-[12px] border-l-4 border-ok bg-ok-soft/50 p-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ok">What to do</p>
          <p className="mt-1.5 text-[16px] leading-relaxed text-ink">{item.how}</p>
        </div>
      ) : null}

      {proof.length > 0 && (
        <>
          <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">From your scan</p>
          <ul className="mt-1.5 space-y-1.5">
            {proof.map(e => (
              <li key={e} className="break-words rounded-[8px] bg-ivory px-3 py-2 text-[14px] leading-relaxed text-ink-soft">{e}</li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-6">
        <TickButton item={item} done={done} mark={mark} action={action} readOnly={readOnly} />
      </div>
    </div>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-paper p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 text-[14px] font-semibold leading-snug text-ink" style={color ? { color } : undefined}>{value}</p>
    </div>
  );
}

/**
 * The numbered guide. Each step can be ticked off as you go; those ticks are
 * a convenience kept in this browser only, never saved: the step's own box
 * is what counts.
 */
function Guide({ stepKey, steps }: { stepKey: string; steps: GuideStep[] }) {
  const storeKey = `guide:${stepKey}`;
  const [checked, setChecked] = useState<number[]>([]);
  // Read after the first paint, so the server's markup (nothing ticked) and the browser's match.
  useEffect(() => {
    let saved: number[] = [];
    try {
      const raw = localStorage.getItem(storeKey);
      saved = raw ? JSON.parse(raw) : [];
    } catch { /* private window: start empty */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecked(saved);
  }, [storeKey]);
  const toggle = (i: number) => setChecked(prev => {
    const next = prev.includes(i) ? prev.filter(n => n !== i) : [...prev, i];
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* private window */ }
    return next;
  });

  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[18px] font-semibold text-ink">Step by step</p>
        <p className="text-[13px] text-muted">{checked.length} of {steps.length}</p>
      </div>
      <ol className="mt-3 space-y-3">
        {steps.map((s, i) => {
          const isOn = checked.includes(i);
          return (
            <li key={`${i}-${s.title}`} className="flex gap-3 rounded-[12px] border border-line p-4">
              <button type="button" onClick={() => toggle(i)} role="checkbox" aria-checked={isOn} aria-label={`Step ${i + 1}: ${s.title}`}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold transition-colors ${
                  isOn ? "bg-ok text-ivory" : "bg-ivory text-ink-soft hover:bg-ok-soft"}`}>
                {isOn ? "✓" : i + 1}
              </button>
              <div className={`min-w-0 flex-1 ${isOn ? "opacity-60" : ""}`}>
                <p className={`text-[15px] font-semibold leading-snug text-ink ${isOn ? "line-through" : ""}`}>{s.title}</p>
                {s.detail && <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{s.detail}</p>}
                {s.links?.length ? (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {s.links.map(l => (
                      <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-line bg-paper px-3 py-1 text-[13px] font-semibold text-ink hover:border-ink-soft">
                        <span className="truncate">{l.label}</span>
                        <span aria-hidden="true">↗</span>
                      </a>
                    ))}
                  </div>
                ) : null}
                {s.copy && <CopyBlock label={s.copy.label} text={s.copy.text} />}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked: the text is there to select */ }
  };
  return (
    <div className="mt-3 overflow-hidden rounded-[10px] border border-line">
      <div className="flex items-center justify-between gap-2 bg-ivory px-3 py-1.5">
        <span className="text-[12px] font-semibold text-ink-soft">{label}</span>
        <button type="button" onClick={copy} className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold text-ink hover:bg-bone">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words bg-paper px-3 py-2.5 font-sans text-[13px] leading-relaxed text-ink">{text}</pre>
    </div>
  );
}

/** One tick, as a form posting the step and its new state. Shared by the box and the buttons. */
function useTick(item: ActionItem, done: boolean, mark: Mark, action: Toggle) {
  const [state, formAction, pending] = useActionState(action, { done });
  // Once every tick sent from this form is answered, show what the server saved.
  useEffect(() => {
    if (!pending) mark(item.key, state.done);
    // `mark` is a new function each render; the saved state is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pending, item.key]);
  return { state, formAction };
}

function TickBox({ item, done, mark, action, readOnly }: {
  item: ActionItem; done: boolean; mark: Mark; action: Toggle; readOnly: boolean;
}) {
  const { state, formAction } = useTick(item, done, mark, action);
  // Ticked here, this visit: only then does the box play its tick.
  const [fresh, setFresh] = useState(false);
  return (
    <form action={formAction} onSubmit={() => { mark(item.key, !done); setFresh(!done); }} className="shrink-0 pt-0.5">
      <input type="hidden" name="key" value={item.key} />
      <input type="hidden" name="done" value={done ? "0" : "1"} />
      <button type="submit" disabled={readOnly} role="checkbox" aria-checked={done}
        aria-label={`${item.title}: ${done ? "done" : "not done"}`} title={done ? "Mark as not done" : "Mark as done"}
        data-fresh={fresh || undefined}
        className={`plan-box flex h-6 w-6 items-center justify-center rounded-[7px] border-2 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-60 ${
          done ? "border-ok bg-ok" : "border-muted bg-transparent hover:border-ok"}`}>
        {done && (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-ivory" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        )}
      </button>
      {state.error && <p className="sr-only" role="alert">{state.error}</p>}
    </form>
  );
}

function TickButton({ item, done, mark, action, readOnly, quiet = false }: {
  item: ActionItem; done: boolean; mark: Mark; action: Toggle; readOnly: boolean;
  /** The lighter look, beside another button. */
  quiet?: boolean;
}) {
  const { state, formAction } = useTick(item, done, mark, action);
  return (
    <form action={formAction} onSubmit={() => mark(item.key, !done)}>
      <input type="hidden" name="key" value={item.key} />
      <input type="hidden" name="done" value={done ? "0" : "1"} />
      <button type="submit" disabled={readOnly}
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          done || quiet ? "border border-line bg-paper text-ink-soft hover:border-ink-soft" : "bg-ok text-ivory hover:brightness-110"}`}>
        {done ? "Done · undo" : "Mark as done"}
      </button>
      {state.error && <p className="mt-2 text-[13px] font-semibold text-flag" role="alert">{state.error}</p>}
    </form>
  );
}
