import type { Engine, Severity } from "@/core/types";
import { ENGINE_LABELS } from "@/components/answer-card";
import { isSafeHttpUrl } from "@/lib/url";
import { Tag, type Tone } from "@/components/ui";

export type FindingCardStatus = "open" | "fixed" | "verified";

const STATUS_EDGE: Record<FindingCardStatus, string> = {
  open: "border-l-flag",
  fixed: "border-l-gold",
  verified: "border-l-ok",
};

const SEVERITY_TAGS: Record<Severity, { label: string; tone: Tone }> = {
  critical: { label: "Serious", tone: "flag" },
  major: { label: "Important", tone: "gold" },
  minor: { label: "Minor", tone: "neutral" },
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
const LABEL = "text-[12px] font-semibold uppercase tracking-[0.1em] text-muted";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** One wrong fact: what AI said next to the truth from the Fact Sheet, which AI tool said it and how much it matters. */
export function FindingCard({
  claim, factValue, severity, status, engine, createdAt, resolvedAt, sources = [], isPrice = false, notSeenLately = false,
}: FindingCardProps) {
  // Engine output is untrusted: only plain web links become clickable.
  // An AI tool can list the same page several times; show it once.
  const links = [...new Set(sources.filter(isSafeHttpUrl))];
  const sev = SEVERITY_TAGS[severity];
  return (
    <article className={`rounded-[20px] border border-l-4 border-line bg-paper p-5 ${STATUS_EDGE[status]}`}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tag tone={sev.tone}>{sev.label}</Tag>
        <Tag>{ENGINE_LABELS[engine]}</Tag>
        {isPrice && <Tag tone="flag">Price</Tag>}
        {status === "fixed" && <Tag tone="gold">Fixed, waiting for the next scan</Tag>}
        {status === "verified" && <Tag tone="ok">Fixed and confirmed</Tag>}
        {notSeenLately && <Tag>Not seen in the latest scan</Tag>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className={LABEL}>AI said</p>
          <p className="mt-1 text-[15px] leading-relaxed text-ink">{claim}</p>
        </div>
        <div>
          <p className={LABEL}>The truth, from your Fact Sheet</p>
          <p className="mt-1 text-[15px] leading-relaxed text-ink">{factValue ?? "N/A"}</p>
        </div>
      </div>
      {links.length > 0 && (
        <div className="mt-4">
          <p className={LABEL}>Pages the AI tool read for this answer</p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
            {links.slice(0, MAX_SOURCES).map(url => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-gold underline-offset-2 hover:underline">
                  {hostOf(url)}
                </a>
              </li>
            ))}
            {links.length > MAX_SOURCES && <li className="text-muted">+{links.length - MAX_SOURCES} more</li>}
          </ul>
        </div>
      )}
      <p className="mt-4 text-[13px] text-muted">
        Found {formatDate(createdAt)}
        {resolvedAt ? ` · Fixed ${formatDate(resolvedAt)}` : ""}
      </p>
    </article>
  );
}
