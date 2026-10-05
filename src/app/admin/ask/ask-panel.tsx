"use client";

import { useState } from "react";
import type { Engine } from "@/core/types";
import { askEngine, type LiveAnswer } from "./actions";

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

const POSITION_LABEL: Record<string, string> = {
  first: "Named first", top3: "Named in top 3", mentioned: "Mentioned", absent: "Not named",
};

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}
const safe = (url: string) => /^https?:\/\//i.test(url);

type Slot = { status: "waiting" } | { status: "done"; result: LiveAnswer };

export function AskPanel({
  engines, practices,
}: {
  engines: { key: Engine; label: string }[];
  practices: { id: string; name: string }[];
}) {
  const [question, setQuestion] = useState("");
  const [practiceId, setPracticeId] = useState("");
  const [slots, setSlots] = useState<Partial<Record<Engine, Slot>>>({});
  const [elapsed, setElapsed] = useState(0);
  const busy = Object.values(slots).some(s => s?.status === "waiting");

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || busy) return;
    setSlots(Object.fromEntries(engines.map(en => [en.key, { status: "waiting" }])));
    const started = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    await Promise.all(engines.map(async en => {
      const result = await askEngine(en.key, question, practiceId || null)
        .catch(err => ({ engine: en.key, ok: false, ms: 0, error: String(err) }) as LiveAnswer);
      setSlots(prev => ({ ...prev, [en.key]: { status: "done", result } }));
    }));
    clearInterval(timer);
  }

  const doneCount = Object.values(slots).filter(s => s?.status === "done").length;

  return (
    <div>
      <form onSubmit={ask} className="mb-6 space-y-3">
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Ask what a customer would ask, e.g. What's the best med spa in Santa Monica for Botox?"
          className={`${inputClass} w-full`}
        />
        <div className="flex flex-wrap items-center gap-3">
          <select value={practiceId} onChange={e => setPracticeId(e.target.value)} className={inputClass}>
            <option value="">Don&apos;t check for a client</option>
            {practices.map(p => <option key={p.id} value={p.id}>Check for: {p.name}</option>)}
          </select>
          <button type="submit" disabled={busy || !question.trim()}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black">
            {busy ? `Asking... ${elapsed}s` : `Ask all ${engines.length} AI tools`}
          </button>
          {Object.keys(slots).length > 0 && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{doneCount} of {engines.length} answered</span>
          )}
        </div>
      </form>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {engines.map(en => {
          const slot = slots[en.key];
          if (!slot) return null;
          if (slot.status === "waiting") {
            return (
              <article key={en.key} className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
                <p className="text-sm font-medium text-black dark:text-zinc-50">{en.label}</p>
                <p className="mt-2 animate-pulse text-sm text-zinc-500 dark:text-zinc-400">Searching the web and writing an answer...</p>
              </article>
            );
          }
          const r = slot.result;
          return (
            <article key={en.key} className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-black dark:text-zinc-50">{en.label}</p>
                <div className="flex items-center gap-2 text-xs">
                  {r.ok && r.mentioned !== undefined && (
                    <span className={`rounded-full px-2.5 py-0.5 font-medium ${r.mentioned
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"}`}>
                      {POSITION_LABEL[r.position ?? "absent"]}
                    </span>
                  )}
                  <span className="text-zinc-500 dark:text-zinc-400">{(r.ms / 1000).toFixed(1)}s</span>
                </div>
              </div>

              {!r.ok ? (
                <p className="text-sm text-red-600 dark:text-red-400">Failed: {r.error}</p>
              ) : (
                <>
                  {r.searchQueries && r.searchQueries.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">What it searched</p>
                      <ul className="mt-1 space-y-0.5 text-xs text-zinc-700 dark:text-zinc-300">
                        {r.searchQueries.map(q => <li key={q}>&ldquo;{q}&rdquo;</li>)}
                      </ul>
                    </div>
                  )}
                  {r.namedOrder && r.namedOrder.length > 0 && (
                    <p className="mb-3 text-xs text-zinc-600 dark:text-zinc-400">
                      <span className="font-medium uppercase tracking-wide text-zinc-500">Named, in order:</span>{" "}
                      {r.namedOrder.join(" → ")}
                    </p>
                  )}
                  <details open className="mb-3">
                    <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Answer</summary>
                    <p className="mt-1 max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {r.answer || "(empty answer)"}
                    </p>
                  </details>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Sites it cited ({r.citations?.length ?? 0})
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {(r.citations ?? []).map((url, i) => (
                      <li key={url + i}>
                        {safe(url) ? (
                          <a href={url} target="_blank" rel="noopener noreferrer"
                            className="text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-400">{hostOf(url)}</a>
                        ) : <span className="text-zinc-500">{url}</span>}
                      </li>
                    ))}
                    {(r.citations?.length ?? 0) === 0 && <li className="text-zinc-500">None</li>}
                  </ul>
                </>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
