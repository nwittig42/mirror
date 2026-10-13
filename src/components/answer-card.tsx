import type { ReactNode } from "react";
import { TONE_LABELS, type Tone } from "@/core/tone";
import { highlightRanges } from "@/core/mention";
import { ENGINE_LABELS } from "@/core/types";
import type { Engine, Position } from "@/core/types";
import { isSafeHttpUrl } from "@/lib/url";
import { Tag, type Tone as TagTone } from "@/components/ui";

export { ENGINE_LABELS };

const POSITION_TAGS: Record<Position, { label: string; tone: TagTone }> = {
  first: { label: "Named first", tone: "ok" },
  top3: { label: "In the top 3", tone: "ok" },
  mentioned: { label: "Named", tone: "gold" },
  absent: { label: "Not named", tone: "neutral" },
};

export function PositionChip({ position }: { position: Position }) {
  const tag = POSITION_TAGS[position];
  return <Tag tone={tag.tone}>{tag.label}</Tag>;
}

/**
 * Renders `text` with every occurrence of a practice-name variation wrapped
 * in <mark>. Built from plain string slices as React children (never
 * dangerouslySetInnerHTML), so it's inherently safe against anything the
 * scanned answer text might contain.
 */
function HighlightedText({ text, names, others }: { text: string; names: string[]; others: string[] }) {
  const ranges = highlightRanges(text, names, others);
  if (ranges.length === 0) return <>{text}</>;

  const segments: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start > cursor) segments.push(<span key={`t${i}`}>{text.slice(cursor, r.start)}</span>);
    segments.push(
      <mark key={`m${i}`} className="rounded bg-gold-soft px-0.5 font-semibold text-ink">
        {text.slice(r.start, r.end)}
      </mark>,
    );
    cursor = r.end;
  });
  if (cursor < text.length) segments.push(<span key="tail">{text.slice(cursor)}</span>);
  return <>{segments}</>;
}

export interface AnswerCardProps {
  promptText: string;
  engine: Engine;
  position: Position;
  answerText: string;
  citations: string[];
  practiceNames: string[];
  searchQueries?: string[];
  tone?: string | null;
  toneReason?: string | null;
  /**
   * The other businesses the check found (its competitorsMentioned), so the
   * highlight agrees with the position chip: in "Harbor Plumbing and Rose
   * City Plumbing are both good" the name is only a mention, not the start
   * of a longer name, once Rose City Plumbing is known.
   */
  others?: string[];
  /**
   * False when the card sits in a list under its question: it then draws as
   * one row of that list, with no box and no question of its own.
   */
  showQuestion?: boolean;
  /** Whether the answer starts unfolded. A card on its own does; a row in a list does not. */
  open?: boolean;
}

const TONE_TAGS: Record<string, TagTone> = {
  positive: "ok",
  neutral: "neutral",
  mixed: "gold",
  negative: "flag",
};

/**
 * One AI answer: which AI tool gave it, where it named the business, and the
 * answer word for word with the business's name marked. The answer folds away
 * under its first line so a long list stays easy to scan.
 */
export function AnswerCard({
  promptText, engine, position, answerText, citations, practiceNames, searchQueries = [], tone, toneReason, others = [],
  showQuestion = true, open = showQuestion,
}: AnswerCardProps) {
  const answer = (
    <details className="py-3" open={open}>
      <summary className="cursor-pointer text-muted marker:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
        <span className="ml-1 inline-flex flex-wrap items-center gap-2 align-middle">
          <span className="text-[15px] font-semibold text-ink">{ENGINE_LABELS[engine]}</span>
          <PositionChip position={position} />
          {tone && TONE_LABELS[tone as Tone] && (
            <span title={toneReason ?? undefined}>
              <Tag tone={TONE_TAGS[tone] ?? "neutral"}>{TONE_LABELS[tone as Tone]}</Tag>
            </span>
          )}
        </span>
      </summary>
      <div className="mt-3">
        {searchQueries.length > 0 && (
          <p className="mb-3 text-[13px] text-muted">
            <span className="font-semibold">Searched for:</span> {searchQueries.map(q => `"${q}"`).join(" · ")}
          </p>
        )}
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">
          <HighlightedText text={answerText} names={practiceNames} others={others} />
        </p>
        {citations.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">Pages it read</p>
            <ul className="mt-1 space-y-1">
              {citations.map((url, i) => (
                <li key={url + i} className="break-all text-[13px] text-muted">
                  {isSafeHttpUrl(url) ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-gold hover:underline">
                      {url}
                    </a>
                  ) : url}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
  if (!showQuestion) return answer;
  return (
    <article className="rounded-[20px] border border-line bg-paper px-5 pb-2 pt-5">
      <p className="text-[17px] font-semibold text-ink">{promptText}</p>
      {answer}
    </article>
  );
}
