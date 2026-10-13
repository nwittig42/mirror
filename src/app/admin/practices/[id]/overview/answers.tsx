import Link from "next/link";
import { ENGINE_NAMES } from "@/core/coverage";
import { domainOf } from "@/core/citations";
import type { Engine } from "@/core/types";
import { Card, Note, Tag, type Tone } from "@/components/ui";
import { Empty, actionClass, formatDate, linkClass } from "@/app/admin/ui";
import { businessHref } from "../tabs";

/** The "AI answers" and "Wrong facts" tabs of the admin customer overview. */

const POSITION: Record<string, { label: string; tone: Tone }> = {
  first: { label: "Named first", tone: "ok" },
  top3: { label: "Named in top 3", tone: "ok" },
  mentioned: { label: "Mentioned", tone: "ok" },
  absent: { label: "Not mentioned", tone: "flag" },
};

// The scan runner stores a vetoed namesake's tone reason as this prefix plus
// the fragment of the answer that placed the business elsewhere.
const DIFFERENT_BUSINESS = "Different business:";

/** The evidence behind a namesake veto, or null when the check was not vetoed. */
function namesakeEvidence(toneReason: string | null | undefined): string | null {
  return toneReason?.startsWith(DIFFERENT_BUSINESS) ? toneReason.slice(DIFFERENT_BUSINESS.length).trim() : null;
}

export function AnswersTab({ date, questions }: {
  date: Date | null;
  questions: {
    prompt: string; kind: string;
    answers: { engine: Engine; answerText: string; position: string; citations: string[]; toneReason?: string | null }[];
    missing: Engine[];
  }[];
}) {
  if (!date || questions.length === 0) return <Card><Empty>No answers yet. They appear after the first scan.</Empty></Card>;
  return (
    <div className="space-y-8">
      <Note>Answers from the scan of {formatDate(date)}. The first run of each question.</Note>
      {questions.map(q => (
        <section key={q.prompt}>
          <h2 className="mb-3 flex flex-wrap items-center gap-2 text-[17px] font-semibold text-ink">
            &ldquo;{q.prompt}&rdquo;
            {q.kind === "branded" && <Tag>Names the business</Tag>}
          </h2>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {q.answers.map(a => {
              const pos = POSITION[a.position] ?? POSITION.absent;
              const sources = [...new Set(a.citations.map(domainOf).filter((d): d is string => !!d))];
              const namesake = namesakeEvidence(a.toneReason);
              return (
                <Card key={a.engine} title={ENGINE_NAMES[a.engine] ?? a.engine} aside={
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {namesake !== null && <Tag tone="gold">Different business</Tag>}
                    <Tag tone={pos.tone}>{pos.label}</Tag>
                  </div>
                }>
                  {namesake !== null && (
                    <Note className="mb-2">
                      The answer describes another business with this name: &ldquo;{namesake}&rdquo;. Not counted as a mention.
                    </Note>
                  )}
                  <p className="line-clamp-6 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">{a.answerText}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[13px]">
                    <span className="text-muted">Sources cited:</span>
                    {sources.length === 0 ? <span className="text-muted">none</span> : sources.map(d => (
                      <span key={d} className="rounded bg-bone px-1.5 py-0.5 font-mono text-[12px] text-ink-soft">{d}</span>
                    ))}
                  </div>
                </Card>
              );
            })}
            {q.missing.map(e => (
              <div key={e} className="flex items-center justify-between rounded-[20px] border border-dashed border-line p-5">
                <span className="text-[15px] font-semibold text-muted">{ENGINE_NAMES[e]}</span>
                <Tag>No answer</Tag>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Wrong facts

export type FactFilter = "open" | "not_seen" | "fixed" | "dismissed" | "all";

const CHIPS: { key: FactFilter; label: string }[] = [
  { key: "open", label: "Open" }, { key: "not_seen", label: "Not seen in latest scan" },
  { key: "fixed", label: "Fixed" }, { key: "dismissed", label: "Dismissed" }, { key: "all", label: "All" },
];
const STATUS: Record<Exclude<FactFilter, "all">, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "flag" }, not_seen: { label: "Not seen in latest scan", tone: "gold" },
  fixed: { label: "Fixed", tone: "ok" }, dismissed: { label: "Dismissed", tone: "neutral" },
};

export function WrongFactsTab({ base, filter, findings, practiceId }: {
  base: string;
  filter: FactFilter;
  practiceId: string;
  findings: { id: string; field: string; said: string; correct: string; engine: Engine; createdAt: Date; group: Exclude<FactFilter, "all"> }[];
}) {
  const count = (k: FactFilter) => k === "all" ? findings.length : findings.filter(f => f.group === k).length;
  const shown = filter === "all" ? findings : findings.filter(f => f.group === filter);
  return (
    <div>
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter wrong facts">
        {CHIPS.map(c => (
          <Link key={c.key} href={`${base}?tab=facts&filter=${c.key}`} aria-current={c.key === filter ? "page" : undefined}
            className={actionClass(c.key === filter ? "primary" : "outline", "sm")}>
            {c.label} · {count(c.key)}
          </Link>
        ))}
      </nav>
      <Card>
        {shown.length === 0 ? <Empty>Nothing in this group.</Empty> : (
          <ul className="divide-y divide-line">
            {shown.map(f => (
              <li key={f.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1 text-[15px]">
                  <div className="font-semibold text-ink">{f.field}</div>
                  <div className="mt-1"><span className="rounded bg-flag-soft px-1.5 py-0.5 text-flag">AI said: {f.said}</span></div>
                  <div className="mt-1 text-ink-soft">Correct: {f.correct}</div>
                  <div className="mt-1 text-[13px] text-muted">{ENGINE_NAMES[f.engine] ?? f.engine} · first seen {formatDate(f.createdAt)}</div>
                </div>
                <Tag tone={STATUS[f.group].tone}>{STATUS[f.group].label}</Tag>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Note className="mt-4">
        Mark a wrong fact fixed or dismissed on the{" "}
        <Link href={businessHref(practiceId, "work", {}, "findings")} className={linkClass}>Work tab of the business page</Link>.
      </Note>
    </div>
  );
}
