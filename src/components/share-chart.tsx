import { PACE_MONTHS } from "@/core/forecast";

/**
 * The share of AI answers that recommend the business, today to 12 months:
 * its line climbing (the likely path, with the low-to-high band behind it)
 * against the top competitor's share today as a flat dashed line.
 */
export function ShareChart({ now, then, rival }: { now: number; then: { low: number; likely: number; high: number }; rival: { name: string; share: number } | null }) {
  const W = 640, H = 220, L = 44, R = 16, T = 16, B = 30;
  // The axis tops out at the next 25% above the highest point, so the climb fills the chart.
  const top = Math.min(100, Math.ceil((Math.max(then.high, rival?.share ?? 0) + 3) / 25) * 25);
  const x = (m: number) => L + (m / PACE_MONTHS) * (W - L - R);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const months = [0, 3, 6, 9, 12];
  const at = (end: number, m: number) => now + (end - now) * (m / PACE_MONTHS);
  const line = months.map(m => `${x(m)},${y(at(then.likely, m))}`).join(" ");
  const band = [...months.map(m => `${x(m)},${y(at(then.high, m))}`), ...[...months].reverse().map(m => `${x(m)},${y(at(then.low, m))}`)].join(" ");
  const ticks = Array.from({ length: top / 25 + 1 }, (_, i) => i * 25).filter(v => v <= top);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-5 w-full" role="img"
      aria-label={`Share of AI answers that recommend you: ${now}% today, about ${then.likely}% in ${PACE_MONTHS} months${rival ? `; ${rival.name} at ${rival.share}% today` : ""}`}>
      {ticks.map(v => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-muted text-[11px]">{v}%</text>
        </g>
      ))}
      {months.map(m => (
        <text key={m} x={x(m)} y={H - 8} textAnchor={m === 0 ? "start" : m === PACE_MONTHS ? "end" : "middle"} className="fill-muted text-[11px]">
          {m === 0 ? "Today" : `${m} months`}
        </text>
      ))}
      {rival && (
        <g>
          <line x1={x(0)} x2={x(PACE_MONTHS)} y1={y(rival.share)} y2={y(rival.share)} className="stroke-muted" strokeWidth={1.5} strokeDasharray="5 5" />
          {/* At the right, under the line: by then the business's line is well above it. */}
          <text x={x(PACE_MONTHS)} y={y(rival.share) + 16} textAnchor="end" className="fill-muted text-[11px]">{rival.name} today, {rival.share}%</text>
        </g>
      )}
      <polygon points={band} className="fill-gold" fillOpacity={0.15} />
      <polyline points={line} fill="none" className="stroke-gold" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(0)} cy={y(now)} r={5} className="fill-ink" />
      <circle cx={x(PACE_MONTHS)} cy={y(then.likely)} r={6} className="fill-gold" />
      <text x={x(0) + 10} y={y(now) + 18} className="fill-ink text-[13px] font-semibold">{now}%</text>
      <text x={x(PACE_MONTHS) - 10} y={y(then.likely) - 12} textAnchor="end" className="fill-gold text-[15px] font-semibold">{then.likely}%</text>
    </svg>
  );
}
