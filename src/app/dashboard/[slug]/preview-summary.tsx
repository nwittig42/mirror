import type { ReactNode } from "react";
import Link from "next/link";
import { Card, Note, ScoreRings, Stat, Tag, buttonClass, type RingScore } from "@/components/ui";
import { ENGINE_NAMES } from "@/core/coverage";
import { topEngine } from "@/core/top-engine";
import { ScoreBreakdown } from "./score-breakdown";
import { OneTimeAuditCard, bookingUrl } from "@/components/locked";

// The rings' colours (see @theme in globals.css), for the key beside them.
const RING_COLOR: Record<RingScore["key"], string> = { overall: "var(--color-ring-overall)", visibility: "var(--color-ring-visibility)", facts: "var(--color-ring-facts)" };

interface PreviewCheck {
  engine: string;
  promptKind: string;
  position?: string | null;
  promptText: string;
  mentioned: boolean;
  answerText: string;
  competitorsMentioned: string[] | null;
}

/** The rest of the audit, open to a free account. */
const OPEN = [
  { path: "answers", title: "Every AI answer", what: "Each answer word for word, with where you were named and where you were left out." },
  { path: "competitors", title: "Competitors and sources", what: "Who AI recommends instead of you, and the websites it reads to decide." },
  { path: "fixes", title: "Your next steps", what: "Every step to get recommended by AI more often, with a box to tick each off." },
];

/** What waits for the call: everything that rests on facts confirmed with the owner. */
const LOCKED = [
  { title: "Fact check", what: "What AI gets right and wrong about your prices, services and hours." },
  { title: "Overall score", what: "Your two scores combined, once your facts are checked." },
  { title: "Fact sheet", what: "The confirmed facts about your business that AI is checked against." },
  { title: "Full reports", what: "The visibility, fact check and monthly reports as PDFs." },
];

/** A sentence cut to length on a word, so a long answer reads as a quote and not a wall. */
function excerpt(text: string, max = 260): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, flat.lastIndexOf(" ", max))}…`;
}

/**
 * The Summary a free account sees before their call: how often AI names
 * them, who it names instead, and one answer that shows it, then links to
 * the rest of their audit and what the call unlocks. No overall score and no
 * fact check: both rest on facts that were read off their website and that
 * nobody has confirmed with them yet.
 */
export function PreviewSummary({ slug, ranking, scanDate, checks, topCompetitor, cta, forecast }: {
  slug: string;
  ranking: number | null;
  scanDate: Date;
  checks: PreviewCheck[];
  topCompetitor: { name: string; mentions: number } | null;
  cta: ReactNode;
  /** The free forecast card, loaded by the page (it reads the database). */
  forecast?: ReactNode;
}) {
  // Buyer questions only: questions that name the business name it back every time.
  const earned = checks.filter(c => c.promptKind !== "branded");
  const named = earned.filter(c => c.mentioned).length;
  const bestTool = topEngine(earned);
  const missed = earned.find(c => !c.mentioned && (c.competitorsMentioned?.length ?? 0) > 0);
  // Overall and Accuracy rest on facts nobody has confirmed yet: their rings stay empty until the call.
  const rings: (RingScore & { note: string })[] = [
    { key: "overall", label: "Overall", value: null, note: "Your two scores combined" },
    { key: "visibility", label: "Recommended by AI", value: ranking, note: "How often and how high AI names you" },
    { key: "facts", label: "Accuracy", value: null, note: "How much of what AI says about you is true" },
  ];

  return (
    <div className="space-y-4">
      <OneTimeAuditCard slug={slug} scanDate={scanDate}>
        This is a one-time snapshot of what AI says about you. AI answers change every week. Start a plan to scan weekly and watch your score move.
      </OneTimeAuditCard>
      <Card title="Your score" aside={<span className="text-[13px] text-muted">Scan of {scanDate.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}</span>}>
        <div className="flex flex-wrap items-center gap-x-10 gap-y-6">
          <ScoreRings rings={rings} />
          <div className="min-w-[240px] flex-1 space-y-1">
            {rings.map(ring => (
              <div key={ring.key} className="-mx-2 flex items-center justify-between gap-4 rounded-xl px-2 py-1.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: RING_COLOR[ring.key] }} aria-hidden="true" />
                    <span className="text-[15px] font-semibold text-ink">{ring.label}</span>
                  </div>
                  <Note className="mt-0.5 pl-[18px]">{ring.note}</Note>
                </div>
                {ring.value === null ? (
                  <a href={bookingUrl()} className={`${buttonClass("gold")} shrink-0 gap-1.5`}>
                    <LockIcon />
                    Schedule a call
                  </a>
                ) : (
                  <div className="shrink-0 whitespace-nowrap">
                    <span className="text-[30px] font-semibold leading-none tracking-tight" style={{ color: RING_COLOR[ring.key] }}>{ring.value}</span>
                    <span className="text-[15px] text-muted">/100</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-[16px] bg-ivory p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-gold"><LockIcon size={18} /></span>
          <div className="min-w-[220px] flex-1">
            <p className="text-[16px] font-semibold text-ink">Unlock Overall and Accuracy</p>
            <p className="mt-0.5 text-[14px] leading-relaxed text-ink-soft">
              We check what AI says against your real prices, services and hours. We confirm them with you once, in 30 minutes, then both scores go live.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {cta}
            <Link href={`/dashboard/${slug}/plans`} className={buttonClass("outline")}>Or start a plan</Link>
          </div>
        </div>
        <ScoreBreakdown score={ranking} checks={checks} />
      </Card>

      {forecast}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card title="Named by AI">
          <Stat value={`${named}/${earned.length}`} unit="answers" tone="gold" />
          <Note className="mt-2">When buyers asked without using your name</Note>
        </Card>
        <Card title="Top competitor">
          {topCompetitor ? (
            <>
              <div className="truncate text-[24px] font-semibold tracking-tight text-ink">{topCompetitor.name}</div>
              <Note className="mt-2">Named {topCompetitor.mentions} time{topCompetitor.mentions === 1 ? "" : "s"}, you {named}</Note>
            </>
          ) : <Note>No competitors named in the latest scan.</Note>}
        </Card>
      </div>

      {missed && (
        <Card title="An answer you were left out of">
          <Note>
            We asked {ENGINE_NAMES[missed.engine as keyof typeof ENGINE_NAMES] ?? missed.engine}: &ldquo;{missed.promptText}&rdquo;
          </Note>
          <p className="mt-3 border-l-2 border-gold pl-4 text-[15px] leading-relaxed text-ink">&ldquo;{excerpt(missed.answerText)}&rdquo;</p>
        </Card>
      )}

      {bestTool && (
        <Card title="Best AI tool">
          <div className="text-[24px] font-semibold tracking-tight text-ink">{ENGINE_NAMES[bestTool.engine as keyof typeof ENGINE_NAMES] ?? bestTool.engine}</div>
          <Note className="mt-2">Named you {bestTool.count} time{bestTool.count === 1 ? "" : "s"}</Note>
        </Card>
      )}

      <Card title="Your one-page summary">
        <p className="text-[15px] text-ink-soft">How you compare, and the three changes that would help most.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/dashboard/${slug}/audit?variant=summary`} className={buttonClass("outline")}>Open</Link>
          <a href={`/dashboard/${slug}/reports/pdf?variant=summary`} download className={buttonClass("primary")}>Download PDF</a>
        </div>
      </Card>

      <Card title="Your full audit">
        <ul className="divide-y divide-line">
          {OPEN.map(item => (
            <li key={item.path} className="py-2.5">
              <Link href={`/dashboard/${slug}/${item.path}`} className="text-[15px] font-semibold text-ink underline decoration-gold underline-offset-4 hover:text-gold">
                {item.title}
              </Link>
              <span className="text-[15px] text-ink-soft">. {item.what}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Unlocks after your call">
        <p className="text-[15px] leading-relaxed text-ink-soft">
          On a 30-minute call we confirm your prices, services and hours with you. Then we check AI against the truth, not a guess, and open the rest:
        </p>
        <ul className="mt-3 divide-y divide-line">
          {LOCKED.map(item => (
            <li key={item.title} className="flex items-baseline gap-3 py-2.5">
              <Tag>Locked</Tag>
              <span className="text-[15px] text-ink-soft"><strong className="font-semibold text-ink">{item.title}.</strong> {item.what}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4">{cta}</div>
      </Card>
    </div>
  );
}

function LockIcon({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="fill-current">
      <path d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1zm2 0h6V7a3 3 0 0 0-6 0v3z" />
    </svg>
  );
}
