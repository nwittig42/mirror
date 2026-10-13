import { classifyDomain, domainOf } from "@/core/citations";
import { findingKey, normalizeClaim } from "@/core/finding-key";
import type { FindingStatus } from "@/core/types";

/**
 * The fix list: every wrong fact as a piece of work with a state the customer
 * can follow. Pure, so the rules are testable without a database.
 *
 * The stored status (open / fixed / verified / dismissed) is what scoring and
 * the scan rely on and is not changed here. "In progress" is an open finding
 * someone has started on: it still counts as open everywhere else, because AI
 * is still saying it.
 */

export type FixState = "todo" | "in_progress" | "fixed" | "confirmed" | "dismissed";

/** The states a customer sees, in the order the list shows them. */
export const FIX_STATES: Exclude<FixState, "dismissed">[] = ["todo", "in_progress", "fixed", "confirmed"];

export const FIX_STATE_LABEL: Record<FixState, string> = {
  todo: "To do",
  in_progress: "In progress",
  fixed: "Fixed, waiting for the next scan",
  confirmed: "Confirmed fixed",
  dismissed: "Not actually wrong",
};

export function fixState(f: { status: FindingStatus; workStartedAt: Date | null }): FixState {
  if (f.status === "dismissed") return "dismissed";
  if (f.status === "verified") return "confirmed";
  if (f.status === "fixed") return "fixed";
  return f.workStartedAt ? "in_progress" : "todo";
}

/** What an operator's choice of state stores: the status, and whether work has started. */
export function storedFor(state: FixState): { status: FindingStatus; started: boolean } {
  switch (state) {
    case "todo": return { status: "open", started: false };
    case "in_progress": return { status: "open", started: true };
    case "fixed": return { status: "fixed", started: true };
    case "confirmed": return { status: "verified", started: true };
    case "dismissed": return { status: "dismissed", started: false };
  }
}

export interface FixAdvice {
  /** Up to three sites the AI tool read for the answer that made the claim. */
  sources: string[];
  onOwnSite: boolean;
  /** One plain sentence: what to change, and where. */
  advice: string;
}

/**
 * Where a wrong fact most likely came from and what to do about it, from the
 * pages the AI tool cited. Their own site first: it is the one source the
 * business controls, and AI read it there.
 */
export function fixAdvice(citations: string[], website: string | null): FixAdvice {
  const ownDomain = domainOf(website?.includes("://") ? website : `https://${website ?? ""}`);
  const sources = [...new Set(citations.map(domainOf).filter((d): d is string => !!d))].slice(0, 3);
  const onOwnSite = !!ownDomain && sources.some(d => classifyDomain(d, ownDomain) === "own_site");
  const advice = onOwnSite
    ? "Correct this on your own website first; AI read it there."
    : sources[0] ? `Ask ${sources[0]} to correct it, and state the right version on your site.`
    : "State the correct version plainly on your website so AI has it.";
  return { sources, onOwnSite, advice };
}

/**
 * A wrong fact that was fixed and then came back is recorded as a new open
 * finding. The old "fixed" row is then out of date: showing both would list
 * one mistake twice, once as fixed. Returns the ids of those stale rows.
 */
export function supersededIds(rows: { id: string; status: FindingStatus; factId: string | null; claim: string }[]): Set<string> {
  const openKeys = new Set(rows.filter(r => r.status === "open").map(findingKey));
  return new Set(rows.filter(r => r.status === "fixed" && openKeys.has(findingKey(r))).map(r => r.id));
}

export interface FixProgress {
  total: number;
  todo: number;
  inProgress: number;
  fixed: number;
  confirmed: number;
  /** Fixed or confirmed, as a share of the total, 0 to 100. */
  percentDone: number;
  /** "7 wrong facts: 3 fixed, 1 in progress, 3 to do." */
  sentence: string;
}

export function fixProgress(states: FixState[]): FixProgress {
  const shown = states.filter(s => s !== "dismissed");
  const count = (s: FixState) => shown.filter(x => x === s).length;
  const todo = count("todo"), inProgress = count("in_progress"), fixed = count("fixed"), confirmed = count("confirmed");
  const total = shown.length;
  const done = fixed + confirmed;
  const parts = [
    done > 0 ? `${done} fixed` : null,
    inProgress > 0 ? `${inProgress} in progress` : null,
    todo > 0 ? `${todo} to do` : null,
  ].filter(Boolean);
  const sentence = total === 0
    ? "No wrong facts found."
    : `${total} wrong fact${total === 1 ? "" : "s"}: ${parts.join(", ")}.`;
  return { total, todo, inProgress, fixed, confirmed, percentDone: total === 0 ? 0 : Math.round((done / total) * 100), sentence };
}

/**
 * Which "fixed" findings a finished scan confirms: the ones it did not see
 * again. Nothing is confirmed by a scan that checked no answers (there was
 * nothing to see), or while an open finding for the same mistake exists.
 *
 * "Seen again" is matched two ways, like the scan's own reconciliation: by
 * the fact the finding is tied to, and by its wording, so an older finding
 * saved without a fact is not confirmed while AI still says the same thing.
 */
export function confirmedByScan(
  prior: { id: string; status: FindingStatus; factId: string | null; claim: string }[],
  seen: { factId?: string | null; claim: string }[],
  judgedChecks: number,
): string[] {
  if (judgedChecks === 0) return [];
  const seenKeys = new Set(seen.map(findingKey));
  const seenClaims = new Set(seen.map(s => normalizeClaim(s.claim)));
  const openKeys = new Set(prior.filter(f => f.status === "open").map(findingKey));
  return prior
    .filter(f => f.status === "fixed"
      && !seenKeys.has(findingKey(f)) && !seenClaims.has(normalizeClaim(f.claim)) && !openKeys.has(findingKey(f)))
    .map(f => f.id);
}
