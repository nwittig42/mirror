function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstIndexOf(answer: string, name: string): number {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(name)}(?![\\p{L}\\p{N}])`, "iu");
  const m = pattern.exec(answer);
  return m ? m.index : -1;
}

export function detectMention(answer: string, variations: string[]): boolean {
  return variations.some(v => firstIndexOf(answer, v) !== -1);
}

export function detectNames(answer: string, names: string[]): string[] {
  return names
    .map(n => ({ n, i: firstIndexOf(answer, n) }))
    .filter(x => x.i !== -1)
    .sort((a, b) => a.i - b.i)
    .map(x => x.n);
}

export interface Match {
  name: string;
  start: number;
  end: number;
}

export function findMatches(answer: string, names: string[]): Match[] {
  return names
    .map(n => {
      const start = firstIndexOf(answer, n);
      return start !== -1 ? { name: n, start, end: start + n.length } : null;
    })
    .filter((m): m is Match => m !== null)
    .sort((a, b) => a.start - b.start);
}

/**
 * Very small "best sentence" heuristic: finds the earliest word-boundary
 * match of any of `names` in `answer` (via `findMatches`, for consistent
 * matching semantics with `checks.mentioned`), then returns the ". "
 * -delimited sentence that contains that match, truncated to ~160 chars.
 * Not NLP — good enough to surface a relevant verbatim snippet (weekly Pulse
 * email, monthly client report) without another judge/LLM round trip. Falls
 * back to `null` when none of `names` appear anywhere in `answer`.
 */
export function extractSnippet(answer: string, names: string[]): string | null {
  const matches = findMatches(answer, names);
  if (matches.length === 0) return null;
  const earliestStart = matches[0].start;

  const sentences = answer.split(". ");
  let offset = 0;
  for (const sentence of sentences) {
    const end = offset + sentence.length;
    if (earliestStart >= offset && earliestStart < end) {
      return sentence.length > 160 ? `${sentence.slice(0, 160)}…` : sentence;
    }
    offset = end + 2; // 2 == length of the ". " delimiter split() consumed
  }
  return null;
}

export interface Range {
  start: number;
  end: number;
}

function allIndicesOf(answer: string, name: string): Range[] {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(name)}(?![\\p{L}\\p{N}])`, "giu");
  const ranges: Range[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(answer)) !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
    if (m[0].length === 0) pattern.lastIndex++; // guard against zero-length matches looping forever
  }
  return ranges;
}

/**
 * Every occurrence (not just the first) of any variation in `answer`,
 * word-boundary matched like `findMatches`, with overlapping/adjacent
 * ranges merged so a caller can highlight without double-wrapping text
 * (e.g. one variation's name containing another's, "Glow" inside "Glow
 * MedSpa"). Sorted by start.
 */
export function highlightRanges(answer: string, variations: string[]): Range[] {
  const all = variations
    .flatMap(v => allIndicesOf(answer, v))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: Range[] = [];
  for (const range of all) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}
