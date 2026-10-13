/**
 * What the engines searched for before answering. The same buyer question
 * fans out into several web searches, and the words the engine adds
 * ("reviews", "near me", "2026", "cost") show what kind of page it is looking
 * for, which is what content to write.
 */

export interface QueryCheck {
  promptKind: string;
  engine: string;
  mentioned: boolean;
  competitorsMentioned: string[];
  searchQueries: string[];
}

export interface QueryRow {
  query: string;
  /** Answers whose engine ran this search. */
  answers: number;
  engines: string[];
  /** Of those, answers that recommended a competitor and not the practice. */
  competitorOnly: number;
}

export interface SearchReport {
  /** Earned (non-branded) answers that reported at least one search. */
  answersWithSearches: number;
  /** Average searches per answer that searched. */
  searchesPerAnswer: number;
  queries: QueryRow[];
  /** Words the engines most often added beyond the buyer's own question. */
  addedWords: { word: string; answers: number }[];
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "for", "in", "on", "at", "to", "is", "are", "what", "which", "who", "how",
  "best", "top", "with", "my", "me", "i", "can", "do", "does", "should", "vs", "by", "from", "your", "you",
]);

// ChatGPT reports its built-in calculator the same way it reports a web search ("calculator: 1+1").
const NOT_A_SEARCH = /^calculator:/;

const normalize = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");
const words = (s: string) => normalize(s).split(/[^a-z0-9]+/).filter(w => w.length > 1 && !STOPWORDS.has(w));

/**
 * Builds the search view from a scan's checks. Branded prompts are left out,
 * as everywhere else in visibility. `promptTexts` maps each check to the
 * question asked, so "added words" can be computed against it.
 */
export function buildSearchReport(checks: (QueryCheck & { promptText: string })[]): SearchReport {
  const rows = new Map<string, QueryRow>();
  const added = new Map<string, number>();
  let answersWithSearches = 0;
  let totalSearches = 0;

  for (const check of checks) {
    if (check.promptKind === "branded") continue;
    const queries = [...new Set(check.searchQueries.map(normalize).filter(q => q && !NOT_A_SEARCH.test(q)))];
    if (queries.length === 0) continue;
    answersWithSearches++;
    totalSearches += queries.length;
    const competitorOnly = !check.mentioned && check.competitorsMentioned.length > 0;

    for (const query of queries) {
      const row = rows.get(query) ?? { query, answers: 0, engines: [], competitorOnly: 0 };
      row.answers++;
      if (!row.engines.includes(check.engine)) row.engines.push(check.engine);
      if (competitorOnly) row.competitorOnly++;
      rows.set(query, row);
    }

    const asked = new Set(words(check.promptText));
    const extra = new Set(queries.flatMap(words).filter(w => !asked.has(w)));
    for (const w of extra) added.set(w, (added.get(w) ?? 0) + 1);
  }

  return {
    answersWithSearches,
    searchesPerAnswer: answersWithSearches ? totalSearches / answersWithSearches : 0,
    queries: [...rows.values()].sort((a, b) => b.answers - a.answers || a.query.localeCompare(b.query)),
    addedWords: [...added.entries()]
      .map(([word, answers]) => ({ word, answers }))
      .sort((a, b) => b.answers - a.answers || a.word.localeCompare(b.word)),
  };
}
