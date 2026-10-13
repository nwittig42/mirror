import type { ReactNode } from "react";
import type { Engine, Severity } from "@/core/types";
import { FIX_STATE_LABEL, type FixState } from "@/core/fix-list";
import { ENGINE_NAMES } from "@/core/coverage";
import { Tag, type Tone } from "@/components/ui";

const EDGE: Record<FixState, string> = {
  todo: "border-l-flag",
  in_progress: "border-l-gold",
  fixed: "border-l-gold",
  confirmed: "border-l-ok",
  dismissed: "border-l-line",
};
const STATE_TONE: Record<FixState, Tone> = {
  todo: "flag", in_progress: "gold", fixed: "gold", confirmed: "ok", dismissed: "neutral",
};
const SEVERITY: Record<Severity, string> = { critical: "Serious", major: "Important", minor: "Minor" };
const LABEL = "text-[12px] font-semibold uppercase tracking-[0.1em] text-muted";

function day(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export interface FixCardProps {
  /** The fact this is about ("Saturday hours"), or null when it matched no fact. */
  topic: string | null;
  claim: string;
  truth: string | null;
  severity: Severity;
  isPrice: boolean;
  engine: Engine;
  state: FixState;
  /** Sites the AI tool read for the answer that made the claim. */
  sources: string[];
  /** One sentence: what to change, and where. */
  advice: string;
  /** A note from us to the customer about the fix. */
  note: string | null;
  noteUpdatedAt: Date | null;
  foundAt: Date;
  fixedAt: Date | null;
  /** Still to do, but the latest scan did not repeat it. */
  notSeenLately?: boolean;
  /** Extra controls under the card (the admin's status form). */
  children?: ReactNode;
}

/**
 * One line of the fix list: what AI said next to the truth, where it most
 * likely read it, what to change, and how far the fix has got.
 */
export function FixCard({
  topic, claim, truth, severity, isPrice, engine, state, sources, advice, note, noteUpdatedAt, foundAt, fixedAt, notSeenLately = false, children,
}: FixCardProps) {
  const done = state === "fixed" || state === "confirmed";
  return (
    <article className={`rounded-[20px] border border-l-4 border-line bg-paper p-5 ${EDGE[state]}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[17px] font-semibold tracking-tight text-ink">{topic ?? "Something AI said about you"}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {isPrice && <Tag tone="flag">Price</Tag>}
          <Tag>{SEVERITY[severity]}</Tag>
          <Tag tone={STATE_TONE[state]}>{FIX_STATE_LABEL[state]}</Tag>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-flag-soft p-4">
          <div className={`${LABEL} text-flag`}>{ENGINE_NAMES[engine] ?? engine} said</div>
          <p className="mt-1 text-[15px] leading-relaxed text-ink">{claim}</p>
        </div>
        <div className="rounded-xl bg-ok-soft p-4">
          <div className={`${LABEL} text-ok`}>The truth, from your Fact Sheet</div>
          <p className="mt-1 text-[15px] font-medium leading-relaxed text-ink">{truth ?? "Your Fact Sheet does not back this up."}</p>
        </div>
      </div>

      {!done && state !== "dismissed" && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className={LABEL}>Where AI read it</div>
            <p className="mt-1 text-[15px] text-ink-soft">
              {sources.length > 0 ? sources.join(", ") : "The AI tool did not say where it read this."}
            </p>
          </div>
          <div>
            <div className={LABEL}>What to change</div>
            <p className="mt-1 text-[15px] text-ink-soft">{advice}</p>
          </div>
        </div>
      )}

      {note && (
        <div className="mt-4 border-l-2 border-gold pl-4">
          <div className={LABEL}>Note from Mirror{noteUpdatedAt ? ` · ${day(noteUpdatedAt)}` : ""}</div>
          <p className="mt-1 text-[15px] leading-relaxed text-ink">{note}</p>
        </div>
      )}

      <p className="mt-4 text-[13px] text-muted">
        Found {day(foundAt)}
        {fixedAt && done ? ` · Fixed ${day(fixedAt)}` : ""}
        {notSeenLately ? " · The latest scan did not repeat it" : ""}
        {state === "fixed" ? " · The next scan checks that AI has stopped saying it" : ""}
      </p>

      {children}
    </article>
  );
}
