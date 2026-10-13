import Link from "next/link";
import type { ReactNode } from "react";
import { blockedReason, coverageLabel, type Coverage } from "@/core/coverage";
import { SUPPORT_TOPICS, type SupportTopic } from "@/services/support";
import { Card, Meter, Note, ScoreDial, Stat, Tag } from "@/components/ui";
import { Empty, ROW, SCAN_STATUS, TD, TH, actionClass, formatDate, linkClass } from "@/app/admin/ui";
import { businessHref } from "../tabs";

/** Tabs of the admin customer overview. Each is a plain server-rendered section. See answers.tsx for the other two. */

type Shown = { overall: number | null; visibility: number | null; facts: number | null; estimated: boolean };

export function KeyValues({ rows }: { rows: { k: string; v: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map(r => (
        <div key={r.k} className="grid grid-cols-[120px_1fr] gap-3 py-2.5 text-[15px]">
          <dt className="text-muted">{r.k}</dt>
          <dd className="min-w-0 break-words text-ink">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

const TWO_COL = "grid items-start gap-4 lg:grid-cols-2";

// ---------------------------------------------------------------- Account

export function AccountTab(p: {
  practice: { id: string; name: string; website: string | null; category: string | null; location: string | null; active: boolean; createdAt: Date; slug: string };
  latest: { startedAt: Date; coverage: Coverage | null; shown: Shown } | null;
  openWrongFacts: number;
  openSupport: number;
  logins: { email: string; mustChangePassword: boolean; hasPassword: boolean; createdAt: Date }[];
}) {
  const l = p.latest;
  const site = p.practice.website;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="Scores">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
            <ScoreDial value={l?.shown.overall ?? null} label="Overall" size={132} />
            <div className="min-w-[220px] flex-1 space-y-4">
              <Meter label="Recommended by AI" value={l?.shown.visibility ?? null} />
              <Meter label="Accuracy" value={l?.shown.facts ?? null} />
              <Note>
                {!l ? "No scores yet. They appear after the first scan."
                  : `Scan of ${formatDate(l.startedAt)}. ${l.shown.estimated
                    ? "Older scan: Recommended by AI rebuilt from its parts, Accuracy estimated. Run a new scan for exact numbers."
                    : coverageLabel(l.coverage) ?? "All AI tools answered."}`}
              </Note>
            </div>
          </div>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Card title="Wrong facts">
            <Stat value={p.openWrongFacts} unit="open in the latest scan" tone={p.openWrongFacts > 0 ? "flag" : "neutral"} />
          </Card>
          <Card title="Support">
            <Stat value={p.openSupport} unit={`open request${p.openSupport === 1 ? "" : "s"}`} tone={p.openSupport > 0 ? "gold" : "neutral"} />
          </Card>
        </div>
      </div>
      <div className={TWO_COL}>
        <Card title="Account">
          <KeyValues rows={[
            { k: "Name", v: p.practice.name },
            { k: "Website", v: site ? <a href={site.includes("://") ? site : `https://${site}`} target="_blank" rel="noreferrer" className={linkClass}>{site}</a> : "Not set" },
            { k: "Kind", v: p.practice.category || "Not set" },
            { k: "Location", v: p.practice.location || "Not set" },
            { k: "Status", v: p.practice.active ? <Tag tone="ok">Active</Tag> : <Tag>Paused</Tag> },
            { k: "Signed up", v: formatDate(p.practice.createdAt) },
            { k: "Dashboard", v: <Link href={`/dashboard/${p.practice.slug}`} className={linkClass}>/dashboard/{p.practice.slug}</Link> },
          ]} />
        </Card>
        <Card title="Logins">
          {p.logins.length === 0 ? <Empty>No logins yet.</Empty> : (
            <ul className="divide-y divide-line">
              {p.logins.map(u => (
                <li key={u.email} className="py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-all text-[15px] font-semibold text-ink">{u.email}</span>
                    {u.mustChangePassword && <Tag tone="gold">Still on temporary password</Tag>}
                    {!u.hasPassword && <Tag>Email link only</Tag>}
                  </div>
                  <div className="text-[13px] text-muted">Added {formatDate(u.createdAt)} · Last login not recorded</div>
                </li>
              ))}
            </ul>
          )}
          <Note className="mt-3">
            Add a login or reset a password on the{" "}
            <Link href={businessHref(p.practice.id, "access")} className={linkClass}>Access tab</Link>. Nothing here emails the customer.
          </Note>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Scores

export function ScoresTab({ scans }: {
  scans: { id: string; status: string; startedAt: Date; coverage: Coverage | null; shown: Shown }[];
}) {
  if (scans.length === 0) return <Card><Empty>No scans yet. Run one from the Scans tab of the business page.</Empty></Card>;
  return (
    <Card title="Every scan" aside={<span className="text-[13px] text-muted">Newest first. Includes blocked, failed and running scans.</span>}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse">
          <thead>
            <tr className="border-b border-line">
              <th className={TH}>Scan</th><th className={TH}>Status</th><th className={TH}>Overall</th>
              <th className={TH}>Recommended by AI</th><th className={TH}>Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {scans.map(s => {
              const st = SCAN_STATUS[s.status] ?? SCAN_STATUS.failed;
              const reason = s.status === "blocked" && s.coverage ? blockedReason(s.coverage)
                : s.status === "failed" ? "The scan hit an error. See internal diagnostics on the Work log tab." : null;
              return (
                <tr key={s.id} className={ROW}>
                  <td className={TD}>
                    <div className="font-semibold text-ink">{formatDate(s.startedAt)}</div>
                    <div className="text-[13px] text-muted">{s.status === "complete" ? coverageLabel(s.coverage) ?? "All AI tools answered" : ""}</div>
                    {reason && <div className="mt-1.5 rounded-lg bg-bone px-3 py-2 text-[13px] text-ink-soft">Why: {reason}</div>}
                  </td>
                  <td className={`${TD} whitespace-nowrap text-ink-soft`}>
                    <span className={`mr-2 inline-block h-2 w-2 rounded-full ${st.dot}`} aria-hidden="true" />{st.label}
                  </td>
                  <td className={`${TD} font-semibold text-ink`}>{s.shown.overall ?? "N/A"}</td>
                  <td className={`${TD} text-ink-soft`}>{s.shown.visibility ?? "N/A"}</td>
                  <td className={`${TD} text-ink-soft`}>
                    {s.status === "complete" ? `${s.shown.facts ?? "N/A"}${s.shown.estimated && s.shown.facts !== null ? "*" : ""}` : "N/A"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {scans.some(s => s.shown.estimated) && (
        <Note className="mt-3">* Estimated: this scan ran before Accuracy was scored the current way.</Note>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Reports

const REPORTS = [
  { kind: "Summary", title: "One-page summary", summary: "1 page: the three scores, top problems, top fixes and the next step.", path: "audit?variant=summary" },
  { kind: "Recommendations", title: "Who AI recommends", summary: "5 pages: every AI tool, competitors, sources and what gets them named more.", path: "audit?variant=visibility" },
  { kind: "Fact check", title: "What AI gets wrong", summary: "3 pages: every wrong fact next to the truth, and how to fix each.", path: "audit?variant=factcheck" },
  { kind: "Full report", title: "Full report", summary: "7 pages: scores, every AI tool, competitors, wrong facts, sources and the action plan.", path: "audit?variant=master" },
  { kind: "Monthly report", title: "Monthly summary", summary: "Score trend, what changed, and the work log for the month.", path: "report" },
];

export function ReportsTab({ slug, latestDate }: { slug: string; latestDate: Date | null }) {
  if (!latestDate) return <Card><Empty>Reports appear once the first scan finishes.</Empty></Card>;
  return (
    <div>
      <Note className="mb-4">Built from the scan of {formatDate(latestDate)}, exactly as the customer sees them.</Note>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map(r => {
          const href = `/dashboard/${slug}/${r.path}`;
          return (
            <Card key={r.kind} title={r.kind} className="flex flex-col">
              <div className="text-[17px] font-semibold text-ink">{r.title}</div>
              <Note className="mt-1 flex-1">{r.summary}</Note>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={href} className={actionClass("primary", "sm")}>Open report</Link>
                <Link href={`${href}${href.includes("?") ? "&" : "?"}print=1`} className={actionClass("outline", "sm")}>Download PDF</Link>
              </div>
            </Card>
          );
        })}
      </div>
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
        <Card title="Fact sheet">
          {facts.length === 0 ? <Empty>No confirmed facts yet.</Empty> : <KeyValues rows={facts.map(f => ({ k: f.label, v: f.value }))} />}
        </Card>
        <div className="space-y-4">
          <Card title="Questions we ask the AI tools">
            {questions.length === 0 ? <Empty>No questions yet.</Empty> : (
              <ol className="list-decimal space-y-1.5 pl-5 text-[15px] text-ink">{questions.map(q => <li key={q}>{q}</li>)}</ol>
            )}
          </Card>
          <Card title="Competitors">
            {competitors.length === 0 ? <Empty>None yet.</Empty> : (
              <div className="flex flex-wrap gap-2">{competitors.map(c => <Tag key={c}>{c}</Tag>)}</div>
            )}
          </Card>
        </div>
      </div>
      <Note className="mt-4">
        Read-only here. <Link href={businessHref(practiceId)} className={linkClass}>Edit on the business page</Link>
      </Note>
    </div>
  );
}

// ---------------------------------------------------------------- Emails

export function EmailsTab() {
  return (
    <Card title="Emails">
      <div className="text-[15px] font-semibold text-ink">We don&apos;t keep a record of sent emails yet.</div>
      <Note className="mt-1">Weekly Pulse, alerts and support receipts go out, but nothing saves them, so this tab can&apos;t show them.</Note>
      <div className="mt-4 text-[14px] font-semibold text-ink">Smallest way to start</div>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-[14px] leading-relaxed text-muted">
        <li>Add one table: <span className="rounded bg-bone px-1 font-mono text-[12px] text-ink-soft">sent_emails</span> (business, kind, to, subject, sent at, email service id).</li>
        <li>Write one row inside the shared send function, so every email type is covered at once.</li>
        <li>This tab lists those rows. Older emails won&apos;t appear.</li>
      </ol>
    </Card>
  );
}

// ---------------------------------------------------------------- Support

export function SupportTab({ requests }: {
  requests: { id: string; topic: string; message: string; email: string; status: string; createdAt: Date }[];
}) {
  if (requests.length === 0) return <Card><Empty>No support requests from this customer.</Empty></Card>;
  return (
    <Card title="Support requests">
      <ul className="divide-y divide-line">
        {requests.map(r => (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-ink">{SUPPORT_TOPICS[r.topic as SupportTopic] ?? r.topic}</div>
              <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">{r.message}</p>
              <div className="mt-1 text-[13px] text-muted">{r.email} · {formatDate(r.createdAt)}</div>
            </div>
            {r.status === "open" ? <Tag tone="gold">Open, waiting on us</Tag> : <Tag tone="ok">Answered</Tag>}
          </li>
        ))}
      </ul>
      <Note className="mt-3">
        Mark requests answered in the <Link href="/admin/support" className={linkClass}>support queue</Link>.
      </Note>
    </Card>
  );
}

// ---------------------------------------------------------------- Work log

export function LogTab({ workLog, diagnostics }: {
  workLog: { id: string; description: string; createdAt: Date }[];
  diagnostics: { id: string; description: string; createdAt: Date }[];
}) {
  return (
    <div className={TWO_COL}>
      <Card title="Work log">
        <Note className="mb-2">The customer sees this.</Note>
        {workLog.length === 0 ? <Empty>Nothing logged yet.</Empty> : (
          <ul className="divide-y divide-line">
            {workLog.map(w => (
              <li key={w.id} className="flex justify-between gap-3 py-2.5">
                <span className="text-[15px] text-ink">{w.description}</span>
                <span className="shrink-0 text-[13px] text-muted">{formatDate(w.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Internal diagnostics">
        <Note className="mb-2">Only we see this.</Note>
        <div className="max-h-[480px] overflow-y-auto rounded-xl bg-ivory p-4 font-mono text-[12px] leading-relaxed text-ink-soft">
          {diagnostics.length === 0 ? <div className="text-muted">No warnings.</div> : diagnostics.map(d => (
            <div key={d.id}><span className="text-muted">{d.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span> {d.description}</div>
          ))}
        </div>
      </Card>
    </div>
  );
}
