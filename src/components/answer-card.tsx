import type { ReactNode } from "react";
import { TONE_LABELS, type Tone } from "@/core/tone";
import { highlightRanges } from "@/core/mention";
import { ENGINE_LABELS } from "@/core/types";
import type { Engine, Position } from "@/core/types";
import { isSafeHttpUrl } from "@/lib/url";

export { ENGINE_LABELS };

const POSITION_STYLES: Record<Position, { label: string; className: string }> = {
  first: { label: "First mention", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  top3: { label: "Top 3", className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  mentioned: { label: "Mentioned", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  absent: { label: "Not mentioned", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400" },
};

export function PositionChip({ position }: { position: Position }) {
  const style = POSITION_STYLES[position];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  );
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
      <mark key={`m${i}`} className="rounded bg-indigo-100 px-0.5 text-inherit dark:bg-indigo-900/60">
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
}

const TONE_STYLES: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  neutral: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
  mixed: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  negative: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

/** One card per check: the prompt asked, which engine answered, and the verbatim answer with mentions highlighted. */
export function AnswerCard({
  promptText, engine, position, answerText, citations, practiceNames, searchQueries = [], tone, toneReason, others = [],
}: AnswerCardProps) {
  return (
    <article className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-black dark:text-zinc-50">{promptText}</p>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            {ENGINE_LABELS[engine]}
          </span>
          <PositionChip position={position} />
          {tone && TONE_LABELS[tone as Tone] && (
            <span title={toneReason ?? undefined}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_STYLES[tone] ?? TONE_STYLES.neutral}`}>
              {TONE_LABELS[tone as Tone]}
            </span>
          )}
        </div>
      </div>
      {searchQueries.length > 0 && (
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-medium">Searched for:</span> {searchQueries.map(q => `"${q}"`).join(" · ")}
        </p>
      )}
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <HighlightedText text={answerText} names={practiceNames} others={others} />
      </p>
      {citations.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-900">
          {citations.map((url, i) =>
            isSafeHttpUrl(url) ? (
              <a
                key={url + i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
              >
                {url}
              </a>
            ) : (
              <span key={url + i} className="text-xs text-zinc-500 dark:text-zinc-400">
                {url}
              </span>
            ),
          )}
        </div>
      )}
    </article>
  );
}
