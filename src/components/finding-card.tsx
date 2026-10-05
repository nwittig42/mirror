import type { Engine, Severity } from "@/core/types";
import { ENGINE_LABELS } from "@/components/answer-card";
import { isSafeHttpUrl } from "@/lib/url";

export type FindingCardStatus = "open" | "fixed" | "verified";

const STATUS_ACCENTS: Record<FindingCardStatus, string> = {
  open: "border-red-300 dark:border-red-900",
  fixed: "border-amber-300 dark:border-amber-900",
  verified: "border-emerald-300 dark:border-emerald-900",
};

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  major: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  minor: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
};

export interface FindingCardProps {
  claim: string;
  factValue: string | null;
  severity: Severity;
  status: FindingCardStatus;
  engine: Engine;
  createdAt: Date;
  resolvedAt: Date | null;
  /** URLs the engine cited in the answer that made the claim. */
  sources?: string[];
  isPrice?: boolean;
  /** Still open, but the latest scan didn't repeat it, so it costs no points now. */
  notSeenLately?: boolean;
}

const MAX_SOURCES = 4;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** One accuracy-ledger card: what the AI claimed vs. what the fact sheet says, side by side. */
export function FindingCard({
  claim, factValue, severity, status, engine, createdAt, resolvedAt, sources = [], isPrice = false, notSeenLately = false,
}: FindingCardProps) {
  // Engine output is untrusted: only plain web links become clickable.
  const links = sources.filter(isSafeHttpUrl);
  return (
    <article className={`rounded-lg border-2 p-5 ${STATUS_ACCENTS[status]}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[severity]}`}>
          {severity}
        </span>
        <span className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          {ENGINE_LABELS[engine]}
        </span>
        {isPrice && (
          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800 dark:bg-rose-950 dark:text-rose-300">
            price
          </span>
        )}
        {notSeenLately && (
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            not seen in latest scan
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">AI claimed</p>
          <p className="mt-1 text-sm text-black dark:text-zinc-50">{claim}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fact sheet says</p>
          <p className="mt-1 text-sm text-black dark:text-zinc-50">{factValue ?? "N/A"}</p>
        </div>
      </div>
      {links.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Pages the AI read for this answer
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {links.slice(0, MAX_SOURCES).map(url => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-400">
                  {hostOf(url)}
                </a>
              </li>
            ))}
            {links.length > MAX_SOURCES && (
              <li className="text-zinc-500 dark:text-zinc-400">+{links.length - MAX_SOURCES} more</li>
            )}
          </ul>
        </div>
      )}
      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        Found {formatDate(createdAt)}
        {resolvedAt ? ` · Resolved ${formatDate(resolvedAt)}` : ""}
      </p>
    </article>
  );
}
