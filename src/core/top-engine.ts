/**
 * The AI tool that named the business in the most answers, with that count.
 * Null when none did or two tie for first, so a page never crowns a winner
 * the numbers don't support.
 */
export function topEngine(checks: { engine: string; mentioned: boolean }[]): { engine: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const c of checks) if (c.mentioned) counts.set(c.engine, (counts.get(c.engine) ?? 0) + 1);
  const [first, second] = [...counts].sort((a, b) => b[1] - a[1]);
  return first && first[1] !== second?.[1] ? { engine: first[0], count: first[1] } : null;
}
