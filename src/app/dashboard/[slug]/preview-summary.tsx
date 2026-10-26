import type { ReactNode } from "react";
import Link from "next/link";
import { Card, Note, ScoreDial, Stat, Tag, buttonClass } from "@/components/ui";
import { ENGINE_NAMES } from "@/core/coverage";

interface PreviewCheck {
  engine: string;
  promptKind: string;
  promptText: string;
  mentioned: boolean;
  answerText: string;
  competitorsMentioned: string[] | null;
}

/** The rest of the audit, open to a free account. */
const OPEN = [
  { path: "answers", title: "Every AI answer", what: "Each answer word for word, with where you were named and where you were left out." },
  { path: "competitors", title: "Competitors and sources", what: "Who AI recommends instead of you, and the websites it reads to decide." },
  { path: "fixes", title: "Your recommendations", what: "The changes that would help most, step by step, in order." },
];

/** What waits for the call: everything that rests on facts confirmed with the owner. */
const LOCKED = [
  { title: "Fact check", what: "What AI gets right and wrong about your prices, services and hours." },
  { title: "Overall score", what: "Your two scores combined, once your facts are checked." },
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
export function PreviewSummary({ slug, ranking, scanDate, checks, topCompetitor, cta }: {
  slug: string;
  ranking: number | null;
  scanDate: Date;
  checks: PreviewCheck[];
  topCompetitor: { name: string; mentions: number } | null;
  cta: ReactNode;
}) {
  // Buyer questions only: questions that name the business name it back every time.
  const earned = checks.filter(c => c.promptKind !== "branded");
  const named = earned.filter(c => c.mentioned).length;
  const byTool = new Map<string, number>();
  for (const c of earned) if (c.mentioned) byTool.set(c.engine, (byTool.get(c.engine) ?? 0) + 1);
  const bestTool = [...byTool.entries()].sort((a, b) => b[1] - a[1])[0];
  const missed = earned.find(c => !c.mentioned && (c.competitorsMentioned?.length ?? 0) > 0);

  return (
    <div className="space-y-4">
      <Card title="Recommended by AI">
        <div className="flex flex-wrap items-center gap-x-10 gap-y-6">
          <ScoreDial value={ranking} label="Score" />
          <p className="max-w-xs text-[15px] leading-relaxed text-ink-soft">How often and how high AI names you when buyers ask without using your name.</p>
        </div>
        <Note className="mt-5">
          From the scan on {scanDate.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}.
          Your overall score and fact check come after your call.
        </Note>
      </Card>

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
          <div className="text-[24px] font-semibold tracking-tight text-ink">{ENGINE_NAMES[bestTool[0] as keyof typeof ENGINE_NAMES] ?? bestTool[0]}</div>
          <Note className="mt-2">Named you {bestTool[1]} time{bestTool[1] === 1 ? "" : "s"}</Note>
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
