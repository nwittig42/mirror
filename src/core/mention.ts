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
