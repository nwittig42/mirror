import { ENGINES, type Engine } from "@/core/types";
import { nameKey } from "@/core/competitors";

/** The slice of a check the competitor report needs. */
export interface CompetitorCheck {
  promptText: string;
  engine: Engine;
  namedOrder: string[];
  mentioned: boolean;
}

export interface CompetitorCell {
  /** Businesses named in this answer, in order of first appearance. */
  names: string[];
  /** Index of the practice within `names`, or -1 when the answer left it out. */
  practiceIndex: number;
}

export interface CompetitorReport {
  totalChecks: number;
  /** Engines that answered at least one question, in canonical order. */
  engines: Engine[];
  /** Every business named across the scan, most-mentioned first. The practice is always present. */
  shareOfVoice: { name: string; mentions: number; isPractice: boolean }[];
  /** One row per question; a cell is absent when that engine never answered it. */
  rows: { promptText: string; cells: Partial<Record<Engine, CompetitorCell>> }[];
}

/**
 * Pure view model for the client's Competitors tab and the audit readout:
 * share of voice, plus the head-to-head table of who each engine named for
 * each question. Assembled from `checks.named_order`, so it reflects every
 * business the scan discovered, not only the operator's typed list.
 */
export function buildCompetitorReport(checks: CompetitorCheck[], practiceNames: string[]): CompetitorReport {
  const canonical = practiceNames[0];
  const practiceKeys = new Set(practiceNames.map(nameKey));
  const isPractice = (name: string) => practiceKeys.has(nameKey(name));

  const mentions = new Map<string, { name: string; mentions: number }>();
  mentions.set(nameKey(canonical), { name: canonical, mentions: 0 });
  const rowsByPrompt = new Map<string, Partial<Record<Engine, CompetitorCell>>>();

  for (const check of checks) {
    const seenInAnswer = new Set<string>();
    for (const raw of check.namedOrder) {
      const key = isPractice(raw) ? nameKey(canonical) : nameKey(raw);
      if (seenInAnswer.has(key)) continue;
      seenInAnswer.add(key);
      const entry = mentions.get(key) ?? { name: raw, mentions: 0 };
      entry.mentions += 1;
      mentions.set(key, entry);
    }

    const cells = rowsByPrompt.get(check.promptText) ?? {};
    cells[check.engine] = {
      names: check.namedOrder,
      practiceIndex: check.namedOrder.findIndex(isPractice),
    };
    rowsByPrompt.set(check.promptText, cells);
  }

  const shareOfVoice = Array.from(mentions.values())
    .map(m => ({ name: m.name, mentions: m.mentions, isPractice: isPractice(m.name) }))
    .sort((a, b) => b.mentions - a.mentions || Number(b.isPractice) - Number(a.isPractice) || a.name.localeCompare(b.name));

  const answered = new Set(checks.map(c => c.engine));
  return {
    totalChecks: checks.length,
    engines: ENGINES.filter(e => answered.has(e)),
    shareOfVoice,
    rows: Array.from(rowsByPrompt.entries()).map(([promptText, cells]) => ({ promptText, cells })),
  };
}
