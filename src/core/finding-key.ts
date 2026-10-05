import type { Severity } from "@/core/types";

/** Lowercase, letters and digits only, single-spaced. "Botox: $9/unit" → "botox 9 unit". */
export function normalizeClaim(claim: string): string {
  return claim.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/**
 * What makes two findings "the same wrong fact". The same error comes back
 * reworded on every run, so a finding tied to a fact is keyed on the fact;
 * only a claim the judge couldn't tie to a fact falls back to its wording.
 */
export function findingKey(f: { factId?: string | null; claim: string }): string {
  return f.factId ? `fact:${f.factId}` : `claim:${normalizeClaim(f.claim)}`;
}

const RANK: Record<Severity, number> = { minor: 0, major: 1, critical: 2 };

export function worseSeverity(a: Severity, b: Severity): Severity {
  return RANK[b] > RANK[a] ? b : a;
}
