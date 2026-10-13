"use client";

import { useState } from "react";
import type { Engine } from "@/core/types";
import { Card, Note, Tag } from "@/components/ui";
import { Button, Select, TextArea, linkClass } from "@/app/admin/ui";
import { askEngine, type LiveAnswer } from "./actions";

const LABEL = "text-[12px] font-semibold uppercase tracking-[0.12em] text-muted";

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
        <TextArea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          rows={2}
          maxLength={500}
          aria-label="Question"
          placeholder="Ask what a customer would ask, e.g. What's the best med spa in Santa Monica for Botox?"
          className="w-full"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Select value={practiceId} onChange={e => setPracticeId(e.target.value)} aria-label="Business to check for">
            <option value="">Don&apos;t check for a business</option>
            {practices.map(p => <option key={p.id} value={p.id}>Check for: {p.name}</option>)}
          </Select>
          <Button disabled={busy || !question.trim()}>
            {busy ? `Asking... ${elapsed}s` : `Ask all ${engines.length} AI tools`}
          </Button>
          {Object.keys(slots).length > 0 && (
            <span className="text-[13px] text-muted">{doneCount} of {engines.length} answered</span>
          )}
        </div>
      </form>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {engines.map(en => {
          const slot = slots[en.key];
          if (!slot) return null;
          if (slot.status === "waiting") {
            return (
              <Card key={en.key} title={en.label}>
                <Note className="animate-pulse">Searching the web and writing an answer...</Note>
              </Card>
            );
          }
          const r = slot.result;
          return (
            <Card key={en.key} title={en.label} aside={
              <div className="flex items-center gap-2">
                {r.ok && r.mentioned !== undefined && (
                  <Tag tone={r.mentioned ? "ok" : "flag"}>{POSITION_LABEL[r.position ?? "absent"]}</Tag>
                )}
                <span className="text-[13px] text-muted">{(r.ms / 1000).toFixed(1)}s</span>
              </div>
            }>
              {!r.ok ? (
                <p className="text-[15px] text-flag">Failed: {r.error}</p>
              ) : (
                <>
                  {r.searchQueries && r.searchQueries.length > 0 && (
                    <div className="mb-3">
                      <p className={LABEL}>What it searched</p>
                      <ul className="mt-1 space-y-0.5 text-[13px] text-ink-soft">
                        {r.searchQueries.map(q => <li key={q}>&ldquo;{q}&rdquo;</li>)}
                      </ul>
                    </div>
                  )}
                  {r.namedOrder && r.namedOrder.length > 0 && (
                    <div className="mb-3">
                      <p className={LABEL}>Named, in order</p>
                      <p className="mt-1 text-[13px] text-ink-soft">{r.namedOrder.join(" → ")}</p>
                    </div>
                  )}
                  <details open className="mb-3">
                    <summary className={`cursor-pointer ${LABEL}`}>Answer</summary>
                    <p className="mt-1 max-h-80 overflow-y-auto whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">
                      {r.answer || "(empty answer)"}
                    </p>
                  </details>
                  <p className={LABEL}>Sites it cited ({r.citations?.length ?? 0})</p>
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
                    {(r.citations ?? []).map((url, i) => (
                      <li key={url + i}>
                        {safe(url) ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className={linkClass}>{hostOf(url)}</a>
                        ) : <span className="text-muted">{url}</span>}
                      </li>
                    ))}
                    {(r.citations?.length ?? 0) === 0 && <li className="text-muted">None</li>}
                  </ul>
                </>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
