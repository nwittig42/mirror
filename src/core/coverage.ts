import type { Engine } from "@/core/types";

/** Under this share of answers back, a scan is blocked rather than published. */
export const MIN_COVERAGE = 0.75;

export const ENGINE_NAMES: Record<Engine, string> = {
  openai: "ChatGPT", anthropic: "Claude", gemini: "Gemini", grok: "Grok", perplexity: "Perplexity",
  google: "Google AI Mode",
};

export interface Coverage {
  asked: number;
  answered: number;
  engines: { engine: Engine; asked: number; answered: number }[];
  /** Engines that answered under half of what they were asked. */
  missing: Engine[];
  /** Under 75% of all answers came back: the scan must not be published. */
  blocked: boolean;
}

/**
 * How much of what a scan asked for actually came back. A failed engine call
 * used to vanish, so rates were computed over fewer answers than the scan
 * claimed; this is what lets the scan say so, or refuse to publish.
 */
export function summarizeCoverage(results: { engine: Engine; ok: boolean }[]): Coverage {
  const byEngine = new Map<Engine, { engine: Engine; asked: number; answered: number }>();
  for (const r of results) {
    const e = byEngine.get(r.engine) ?? { engine: r.engine, asked: 0, answered: 0 };
    e.asked++;
    if (r.ok) e.answered++;
    byEngine.set(r.engine, e);
  }
  const engines = [...byEngine.values()];
  const asked = results.length;
  const answered = results.filter(r => r.ok).length;
  return {
    asked, answered, engines,
    missing: engines.filter(e => e.answered < e.asked / 2).map(e => e.engine),
    blocked: asked > 0 && answered / asked < MIN_COVERAGE,
  };
}

function listNames(engines: Engine[]): string {
  const names = engines.map(e => ENGINE_NAMES[e]);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "Based on 4 of 5 AI tools. Gemini didn't respond.", or null when nothing is missing. */
export function coverageLabel(c: Coverage | null): string | null {
  if (!c || c.missing.length === 0) return null;
  const total = c.engines.length;
  return `Based on ${total - c.missing.length} of ${total} AI tools. ${listNames(c.missing)} didn't respond.`;
}

/** Why a scan was blocked, for the operator. */
export function blockedReason(c: Coverage): string {
  const pct = c.asked ? Math.round((100 * c.answered) / c.asked) : 0;
  const who = c.missing.length ? ` ${listNames(c.missing)} didn't respond.` : "";
  return `Only ${pct}% of answers came back.${who}`;
}
