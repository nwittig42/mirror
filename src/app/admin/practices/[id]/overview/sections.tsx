import Link from "next/link";
import type { ReactNode } from "react";
import { ENGINE_NAMES, blockedReason, coverageLabel, type Coverage } from "@/core/coverage";
import { domainOf } from "@/core/citations";
import type { Engine } from "@/core/types";
import { SUPPORT_TOPICS, type SupportTopic } from "@/services/support";
import { ACCENT_TEXT, Pill, SCAN_STATUS, formatDate, type Tone } from "@/app/admin/ui";
import { ScoreRings, ScoreRingsWithLegend } from "@/components/score-rings";

/** The tabs of the admin customer overview. Each is a plain server-rendered section. */

export function H2({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-base font-semibold text-black">{children}</h2>
      {note && <span className="text-[13px] text-zinc-500">{note}</span>}
    </div>
  );
}

function KeyValues({ rows }: { rows: { k: string; v: ReactNode }[] }) {
  return (
    <div className="text-sm">
      {rows.map(r => (
        <div key={r.k} className="grid grid-cols-[120px_1fr] gap-3 border-b border-[#f0f0f0] py-2.5">
          <div className="text-zinc-500">{r.k}</div>
          <div className="min-w-0 break-words text-black">{r.v}</div>
        </div>
      ))}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-[10px] border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">{children}</p>;
}

function SummaryCard({ label, value, sub, hue }: { label: string; value: ReactNode; sub: string; hue: number }) {
  return (
    <div className="rounded-[10px] p-4" style={{ background: `oklch(0.96 0.03 ${hue})`, border: `1px solid oklch(0.88 0.06 ${hue})` }}>
      <div className="text-[13px] text-zinc-600">{label}</div>
      <div className="text-[30px] font-bold leading-tight" style={{ color: `oklch(0.35 0.12 ${hue})` }}>{value}</div>
      <div className="text-xs text-zinc-600">{sub}</div>
    </div>
  );
}

const TWO_COL = "grid gap-7 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]";

// ---------------------------------------------------------------- Account

export function AccountTab(p: {
  practice: { name: string; website: string | null; category: string | null; location: string | null; active: boolean; createdAt: Date; slug: string };
  latest: { startedAt: Date; coverage: Coverage | null; shown: { overall: number | null; visibility: number | null; facts: number | null; estimated: boolean } } | null;
  openWrongFacts: number;
  openSupport: number;
  logins: { email: string; mustChangePassword: boolean; hasPassword: boolean; createdAt: Date }[];
}) {
  const l = p.latest;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-[10px] border border-[#e4e4e7] p-5">
        {l ? (
          <ScoreRingsWithLegend
            scores={l.shown}
            note={`Scan of ${formatDate(l.startedAt)}. ${l.shown.estimated
              ? "Older scan: ranking rebuilt from its parts, fact check estimated. Run a new scan for exact numbers."
              : coverageLabel(l.coverage) ?? "All AI tools answered."}`} />
        ) : (
          <div className="flex items-center gap-5">
            <ScoreRings scores={{ overall: null, visibility: null, facts: null }} size={120} />
            <p className="text-sm text-zinc-500">No scores yet. They appear after the first scan.</p>
          </div>
        )}
        <div className="grid min-w-[180px] flex-1 gap-3 sm:max-w-[220px]">
          <SummaryCard label="Wrong facts" value={p.openWrongFacts} hue={25} sub="open in the latest scan" />
          <SummaryCard label="Support" value={p.openSupport} hue={70} sub={`open request${p.openSupport === 1 ? "" : "s"}`} />
        </div>
      </div>
      <div className={TWO_COL}>
        <div>
          <H2>Account</H2>
          <KeyValues rows={[
            { k: "Name", v: p.practice.name },
            { k: "Website", v: p.practice.website ? <a href={p.practice.website.includes("://") ? p.practice.website : `https://${p.practice.website}`} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline" style={{ color: ACCENT_TEXT }}>{p.practice.website}</a> : "Not set" },
            { k: "Category", v: p.practice.category || "Not set" },
            { k: "Location", v: p.practice.location || "Not set" },
            { k: "Status", v: p.practice.active ? <Pill tone="green">Active</Pill> : <Pill tone="gray">Paused</Pill> },
            { k: "Signed up", v: formatDate(p.practice.createdAt) },
            { k: "Dashboard", v: <Link href={`/dashboard/${p.practice.slug}`} className="underline-offset-2 hover:underline" style={{ color: ACCENT_TEXT }}>/dashboard/{p.practice.slug}</Link> },
          ]} />
        </div>
        <div>
          <H2>Logins</H2>
          {p.logins.length === 0 ? <Empty>No logins yet. Issue one on the practice page.</Empty> : (
            <div className="text-sm">
              {p.logins.map(u => (
                <div key={u.email} className="border-b border-[#f0f0f0] py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-black">{u.email}</span>
                    {u.mustChangePassword && <Pill tone="amber">Still on temporary password</Pill>}
                    {!u.hasPassword && <Pill tone="gray">Email link only</Pill>}
                  </div>
                  <div className="text-xs text-zinc-500">Added {formatDate(u.createdAt)} · Last login not recorded</div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-zinc-500">Password resets stay on the practice page. Nothing here emails the customer.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Scores

export function ScoresTab({ scans }: {
  scans: { id: string; status: string; startedAt: Date; coverage: Coverage | null; shown: { overall: number | null; visibility: number | null; facts: number | null; estimated: boolean } }[];
}) {
  if (scans.length === 0) return <Empty>No scans yet. Run one from the practice page.</Empty>;
  const grid = "grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_60px_70px_50px] gap-3 items-center";
  return (
    <div>
      <H2 note="Newest first · includes blocked, failed and running scans">Every scan</H2>
      <div className="overflow-x-auto">
        <div className="min-w-[520px] text-sm">
          <div className={`${grid} border-b border-[#e4e4e7] pb-2 text-[13px] text-zinc-500`}>
            <div>Scan</div><div>Status</div><div>Overall</div><div>Ranking</div><div>Facts</div>
          </div>
          {scans.map(s => {
            const st = SCAN_STATUS[s.status] ?? SCAN_STATUS.failed;
            const reason = s.status === "blocked" && s.coverage ? blockedReason(s.coverage)
              : s.status === "failed" ? "The scan hit an error. See internal diagnostics on the Work log tab." : null;
            return (
              <div key={s.id} className="border-b border-[#f0f0f0] py-3">
                <div className={grid}>
                  <div className="flex items-center gap-2.5">
                    <ScoreRings scores={s.shown} size={34} />
                    <div>
                    <div className="font-medium text-black">{formatDate(s.startedAt)}</div>
                    <div className="text-xs text-zinc-500">{s.status === "complete" ? coverageLabel(s.coverage) ?? "All AI tools answered" : ""}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: st.dot }} />{st.label}
                  </div>
                  <div className="font-semibold text-black">{s.shown.overall ?? "—"}</div>
                  <div>{s.shown.visibility ?? "—"}</div>
                  <div>{s.status === "complete" ? `${s.shown.facts ?? "N/A"}${s.shown.estimated && s.shown.facts !== null ? "*" : ""}` : "—"}</div>
                </div>
                {reason && <div className="mt-2 rounded-md bg-[#f4f4f5] px-3 py-2 text-[13px] text-zinc-700">Why: {reason}</div>}
              </div>
            );
          })}
        </div>
      </div>
      {scans.some(s => s.shown.estimated) && (
        <p className="mt-3 text-xs text-zinc-500">* Estimated: this scan ran before fact checks were scored the current way.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Reports

const REPORTS = [
  { kind: "Summary", hue: 300, title: "One-page summary", summary: "1 page: the three scores, top problems, top fixes and the next step.", path: "audit?variant=summary" },
  { kind: "Full audit", hue: 265, title: "Full AI audit", summary: "12 pages: score, every AI tool, competitors, sources, wrong facts and the 90-day plan.", path: "audit?variant=master" },
  { kind: "Ranking snapshot", hue: 210, title: "Where you rank", summary: "5 pages: how often and how high AI names them, tool by tool.", path: "audit?variant=visibility" },
  { kind: "Fact check", hue: 150, title: "What AI gets wrong", summary: "4 pages: every fact checked, true or false, and how to fix it.", path: "audit?variant=factcheck" },
  { kind: "Monthly report", hue: 60, title: "Monthly summary", summary: "Score trend, what changed, and the work log for the month.", path: "report" },
];

export function ReportsTab({ slug, latestDate }: { slug: string; latestDate: Date | null }) {
  if (!latestDate) return <Empty>Reports appear once the first scan finishes.</Empty>;
  return (
    <div>
      <H2 note="Built from the latest scan, exactly as the customer sees them">Reports</H2>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
        {REPORTS.map(r => {
          const href = `/dashboard/${slug}/${r.path}`;
          return (
            <div key={r.kind} className="flex flex-col overflow-hidden rounded-[10px] border border-[#e4e4e7] bg-white">
              <div className="h-1.5" style={{ background: `oklch(0.6 0.15 ${r.hue})` }} />
              <div className="flex-1 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: `oklch(0.45 0.15 ${r.hue})` }}>{r.kind}</div>
                <div className="mt-1 font-semibold text-black">{r.title}</div>
                <p className="mt-1 text-[13px] text-zinc-600">{r.summary}</p>
                <div className="mt-2 text-xs text-zinc-500">From the scan of {formatDate(latestDate)}</div>
              </div>
              <div className="grid grid-cols-2 border-t border-[#e4e4e7] text-center text-[13px] font-medium">
                <Link href={href} className="border-r border-[#e4e4e7] py-2.5 hover:bg-zinc-50" style={{ color: ACCENT_TEXT }}>Open report</Link>
                <Link href={`${href}${href.includes("?") ? "&" : "?"}print=1`} className="py-2.5 hover:bg-zinc-50" style={{ color: ACCENT_TEXT }}>Download PDF</Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- AI answers

const POSITION: Record<string, { label: string; tone: Tone }> = {
  first: { label: "Mentioned · #1", tone: "green" },
  top3: { label: "Mentioned · top 3", tone: "green" },
  mentioned: { label: "Mentioned", tone: "green" },
  absent: { label: "Not mentioned", tone: "red" },
};

export function AnswersTab({ date, questions }: {
  date: Date | null;
  questions: { prompt: string; kind: string; answers: { engine: Engine; answerText: string; position: string; citations: string[] }[]; missing: Engine[] }[];
}) {
  if (!date || questions.length === 0) return <Empty>No answers yet. They appear after the first scan.</Empty>;
  return (
    <div className="space-y-8">
      <H2 note="First run of each question">{`Latest answers · ${formatDate(date)}`}</H2>
      {questions.map(q => (
        <div key={q.prompt}>
          <div className="mb-3 text-sm text-zinc-600">
            Question: <span className="font-medium text-black">&ldquo;{q.prompt}&rdquo;</span>
            {q.kind === "branded" && <span className="ml-2"><Pill tone="gray">Names the business</Pill></span>}
          </div>
          <div className="space-y-3">
            {q.answers.map(a => {
              const pos = POSITION[a.position] ?? POSITION.absent;
              const sources = [...new Set(a.citations.map(domainOf).filter((d): d is string => !!d))];
              return (
                <div key={a.engine} className="rounded-[10px] border border-[#e4e4e7] p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="font-semibold text-black">{ENGINE_NAMES[a.engine] ?? a.engine}</div>
                    <Pill tone={pos.tone}>{pos.label}</Pill>
                  </div>
                  <p className="line-clamp-6 whitespace-pre-wrap text-sm text-zinc-700">{a.answerText}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-zinc-500">Sources cited:</span>
                    {sources.length === 0 ? <span className="text-zinc-400">none</span> : sources.map(d => (
                      <span key={d} className="rounded bg-[#f4f4f5] px-1.5 py-0.5 font-mono text-zinc-700">{d}</span>
                    ))}
                  </div>
                </div>
              );
            })}
            {q.missing.map(e => (
              <div key={e} className="flex items-center justify-between rounded-[10px] border border-dashed border-zinc-300 p-4">
                <div className="font-semibold text-zinc-500">{ENGINE_NAMES[e]}</div>
                <Pill tone="gray">No answer</Pill>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Wrong facts

export type FactFilter = "open" | "not_seen" | "fixed" | "dismissed" | "all";

export function WrongFactsTab({ base, filter, findings, practiceId }: {
  base: string;
  filter: FactFilter;
  practiceId: string;
  findings: { id: string; field: string; said: string; correct: string; engine: Engine; createdAt: Date; group: Exclude<FactFilter, "all"> }[];
}) {
  const CHIPS: { key: FactFilter; label: string }[] = [
    { key: "open", label: "Open" }, { key: "not_seen", label: "Not seen in latest scan" },
    { key: "fixed", label: "Fixed" }, { key: "dismissed", label: "Dismissed" }, { key: "all", label: "All" },
  ];
  const STATUS: Record<Exclude<FactFilter, "all">, { label: string; tone: Tone }> = {
    open: { label: "Open", tone: "red" }, not_seen: { label: "Not seen in latest scan", tone: "amber" },
    fixed: { label: "Fixed", tone: "green" }, dismissed: { label: "Dismissed", tone: "gray" },
  };
  const count = (k: FactFilter) => k === "all" ? findings.length : findings.filter(f => f.group === k).length;
  const shown = filter === "all" ? findings : findings.filter(f => f.group === filter);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {CHIPS.map(c => (
          <Link key={c.key} href={`${base}?tab=facts&filter=${c.key}`}
            className={`rounded-full border px-3 py-1 text-[13px] ${c.key === filter ? "border-black bg-black text-white" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"}`}>
            {c.label} · {count(c.key)}
          </Link>
        ))}
      </div>
      {shown.length === 0 ? <Empty>Nothing in this group.</Empty> : (
        <div className="text-sm">
          {shown.map(f => (
            <div key={f.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0f0f0] py-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-black">{f.field}</div>
                <div className="mt-1"><span className="rounded px-1.5 py-0.5" style={{ background: "oklch(0.95 0.05 25)", color: "oklch(0.42 0.13 25)" }}>AI said: {f.said}</span></div>
                <div className="mt-1 text-zinc-700">Correct: {f.correct}</div>
                <div className="mt-1 text-xs text-zinc-500">{ENGINE_NAMES[f.engine] ?? f.engine} · first seen {formatDate(f.createdAt)}</div>
              </div>
              <Pill tone={STATUS[f.group].tone}>{STATUS[f.group].label}</Pill>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-zinc-500">
        Triage (fix / dismiss) stays on the <Link href={`/admin/practices/${practiceId}#findings`} className="underline-offset-2 hover:underline" style={{ color: ACCENT_TEXT }}>practice page</Link> for now.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Setup

export function SetupTab({ practiceId, facts, questions, competitors }: {
  practiceId: string;
  facts: { label: string; value: string }[];
  questions: string[];
  competitors: string[];
}) {
  return (
    <div>
      <div className={TWO_COL}>
        <div>
          <H2>Fact sheet</H2>
          {facts.length === 0 ? <Empty>No confirmed facts yet.</Empty> : <KeyValues rows={facts.map(f => ({ k: f.label, v: f.value }))} />}
        </div>
        <div className="space-y-7">
          <div>
            <H2>Questions we ask the AI tools</H2>
            {questions.length === 0 ? <Empty>No questions yet.</Empty> : (
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-black">{questions.map(q => <li key={q}>{q}</li>)}</ol>
            )}
          </div>
          <div>
            <H2>Competitors</H2>
            {competitors.length === 0 ? <Empty>None yet.</Empty> : (
              <div className="flex flex-wrap gap-2">{competitors.map(c => <Pill key={c} tone="gray">{c}</Pill>)}</div>
            )}
          </div>
        </div>
      </div>
      <p className="mt-5 text-xs text-zinc-500">
        Read-only here. <Link href={`/admin/practices/${practiceId}`} className="underline-offset-2 hover:underline" style={{ color: ACCENT_TEXT }}>Edit on the practice page ↗</Link>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Emails

export function EmailsTab() {
  return (
    <div className="rounded-[10px] border border-dashed border-zinc-300 p-5 text-sm">
      <div className="font-semibold text-black">We don&apos;t keep a record of sent emails yet.</div>
      <p className="mt-1 text-zinc-600">Weekly Pulse, alerts and support receipts go out, but nothing saves them, so this tab can&apos;t show them.</p>
      <div className="mt-4 text-[13px] font-semibold text-black">Smallest way to start</div>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-zinc-600">
        <li>Add one table: <span className="rounded bg-[#f4f4f5] px-1 font-mono text-xs">sent_emails</span> (practice, kind, to, subject, sent at, provider id).</li>
        <li>Write one row inside the shared send function, so every email type is covered at once.</li>
        <li>This tab lists those rows. Older emails won&apos;t appear.</li>
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- Support

export function SupportTab({ requests }: {
  requests: { id: string; topic: string; message: string; email: string; status: string; createdAt: Date }[];
}) {
  if (requests.length === 0) return <Empty>No support requests from this customer.</Empty>;
  return (
    <div>
      <div className="text-sm">
        {requests.map(r => (
          <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0f0f0] py-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-black">{SUPPORT_TOPICS[r.topic as SupportTopic] ?? r.topic}</div>
              <p className="mt-1 whitespace-pre-wrap text-zinc-700">{r.message}</p>
              <div className="mt-1 text-xs text-zinc-500">{r.email} · {formatDate(r.createdAt)}</div>
            </div>
            {r.status === "open" ? <Pill tone="amber">Open · waiting on us</Pill> : <Pill tone="green">Answered · closed</Pill>}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-zinc-500">
        Close requests from the queue on <Link href="/admin#support" className="underline-offset-2 hover:underline" style={{ color: ACCENT_TEXT }}>/admin</Link>, same as today.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Work log

export function LogTab({ workLog, diagnostics }: {
  workLog: { id: string; description: string; createdAt: Date }[];
  diagnostics: { id: string; description: string; createdAt: Date }[];
}) {
  return (
    <div className={TWO_COL}>
      <div>
        <H2>Work log</H2>
        <div className="-mt-2 mb-3 text-xs text-zinc-500">The customer sees this</div>
        {workLog.length === 0 ? <Empty>Nothing logged yet.</Empty> : (
          <div className="text-sm">
            {workLog.map(w => (
              <div key={w.id} className="flex justify-between gap-3 border-b border-[#f0f0f0] py-2.5">
                <div className="text-black">{w.description}</div>
                <div className="shrink-0 text-xs text-zinc-500">{formatDate(w.createdAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <H2>Internal diagnostics</H2>
        <div className="-mt-2 mb-3 text-xs text-zinc-500">Only operators see this</div>
        <div className="max-h-[480px] overflow-y-auto rounded-[10px] bg-[#18181b] p-4 font-mono text-xs leading-relaxed text-zinc-200">
          {diagnostics.length === 0 ? <div className="text-zinc-500">No warnings.</div> : diagnostics.map(d => (
            <div key={d.id}><span className="text-zinc-500">{d.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span> {d.description}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
