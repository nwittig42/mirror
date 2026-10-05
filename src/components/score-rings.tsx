import { useId } from "react";

/**
 * Apple Watch–style rings for the three scores: each ring fills to its score
 * out of 100. Outer = overall, middle = fact check, inner = ranking.
 */

/**
 * Ring colors: bright two-stop gradients on black, in the style of Apple
 * Watch activity rings but deliberately not Apple's own Move / Exercise /
 * Stand colors (Apple reserves those for fitness data).
 */
export const RING_COLORS = {
  overall: { from: "#7c5cff", to: "#c77dff", label: "#a78bfa" },
  facts: { from: "#22c55e", to: "#a3e635", label: "#4ade80" },
  visibility: { from: "#0ea5e9", to: "#67e8f9", label: "#38bdf8" },
} as const;

/** SVG dash for a ring of radius `r` filled to `score`/100 (none when null). */
export function ringDash(score: number | null, r: number): string {
  const circ = 2 * Math.PI * r;
  const filled = circ * Math.min(1, Math.max(0, (score ?? 0) / 100));
  return `${filled} ${circ - filled}`;
}

export interface RingScores { overall: number | null; visibility: number | null; facts: number | null }

/**
 * Outer to inner: overall, fact check, ranking (visibility). Drawn on a black
 * disc with a margin the width of the gap between rings, each ring starting
 * at 12 o'clock and filling clockwise with rounded ends over a dim track.
 */
export function ScoreRings({ scores, size = 160 }: { scores: RingScores; size?: number }) {
  const uid = useId().replace(/:/g, "");
  const stroke = size * 0.105;
  const gap = Math.max(1, size * 0.018);
  const c = size / 2;
  const rings = [
    { key: "overall", value: scores.overall, ...RING_COLORS.overall },
    { key: "facts", value: scores.facts, ...RING_COLORS.facts },
    { key: "visibility", value: scores.visibility, ...RING_COLORS.visibility },
  ];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" className="shrink-0"
      aria-label={`Overall ${scores.overall ?? "N/A"}, fact check ${scores.facts ?? "N/A"}, ranking ${scores.visibility ?? "N/A"}`}>
      <defs>
        {rings.map(ring => (
          <linearGradient key={ring.key} id={`${uid}-${ring.key}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={ring.from} />
            <stop offset="100%" stopColor={ring.to} />
          </linearGradient>
        ))}
      </defs>
      <circle cx={c} cy={c} r={c} fill="#000" />
      {rings.map((ring, i) => {
        const r = c - gap - stroke / 2 - i * (stroke + gap);
        return (
          <g key={ring.key} transform={`rotate(-90 ${c} ${c})`}>
            <circle cx={c} cy={c} r={r} fill="none" stroke={ring.from} strokeOpacity={0.22} strokeWidth={stroke} />
            {(ring.value ?? 0) > 0 && (
              <circle cx={c} cy={c} r={r} fill="none" stroke={`url(#${uid}-${ring.key})`} strokeWidth={stroke}
                strokeLinecap="round" strokeDasharray={ringDash(ring.value, r)} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Rings plus each score, on a black card like the Fitness app: labels and
 * numbers in their ring's color, outer to inner.
 */
export function ScoreRingsWithLegend({ scores, note }: { scores: RingScores; note?: string }) {
  const rows = [
    { label: "Overall", value: scores.overall, color: RING_COLORS.overall.label },
    { label: "Fact check", value: scores.facts, color: RING_COLORS.facts.label },
    { label: "Ranking", value: scores.visibility, color: RING_COLORS.visibility.label },
  ];
  return (
    <div className="flex flex-wrap items-center gap-7 rounded-[22px] bg-black px-6 py-5">
      <ScoreRings scores={scores} size={176} />
      <div className="space-y-2.5">
        {rows.map(r => (
          <div key={r.label}>
            <div className="text-[13px] font-semibold" style={{ color: "#f5f5f7" }}>{r.label}</div>
            <div className="text-[28px] font-bold leading-none tracking-tight" style={{ color: r.color }}>
              {r.value ?? "N/A"}<span className="text-lg">/100</span>
            </div>
          </div>
        ))}
        {note && <div className="max-w-[260px] pt-1 text-xs text-zinc-400">{note}</div>}
      </div>
    </div>
  );
}
