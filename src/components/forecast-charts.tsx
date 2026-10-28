import type { ReactNode } from "react";

/**
 * The two charts of the forecast: a score heading from its scans so far into
 * a forecast, and a small rising curve for one growth figure. Both are plain
 * SVG drawn on the server, in the theme's colours (pass stroke-*, fill-* and
 * text-* classes; each score keeps the colour it has on the Overview page).
 */

interface Ahead { label: string; low: number; likely: number; high: number }

/**
 * A smooth curve through the points that never overshoots a value: where the
 * line keeps climbing it bends gently, and where it turns it flattens first.
 * (A monotone cubic: each point's slope is the mean of the slopes either side
 * of it, or level when they point opposite ways.)
 */
function curve(points: [number, number][]): string {
  const slope = (i: number) => (points[i + 1][1] - points[i][1]) / ((points[i + 1][0] - points[i][0]) || 1);
  const tangent = points.map((_, i) => {
    if (points.length < 2) return 0;
    if (i === 0) return slope(0);
    if (i === points.length - 1) return slope(i - 1);
    const before = slope(i - 1), after = slope(i);
    return before * after <= 0 ? 0 : (2 * before * after) / (before + after);
  });
  return points.map(([px, py], i) => {
    if (i === 0) return `M${px.toFixed(1)} ${py.toFixed(1)}`;
    const [qx, qy] = points[i - 1];
    const third = (px - qx) / 3;
    return `C${(qx + third).toFixed(1)} ${(qy + tangent[i - 1] * third).toFixed(1)} ${(px - third).toFixed(1)} ${(py - tangent[i] * third).toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)}`;
  }).join(" ");
}

/** The same curve walked backwards, for closing a shaded band. */
function curveBack(points: [number, number][]): string {
  return curve([...points].reverse()).replace(/^M/, "L");
}

export interface ScoreChartLine {
  key: string;
  label: string;
  /** Past scans, oldest first, ending with the latest. Null where a scan has no score. */
  past: (number | null)[];
  ahead: Ahead[];
  /** The score's colour on the Overview page, as theme classes. */
  stroke: string; fill: string; text: string; dot: string;
}

/**
 * The three scores as chart lines, each in its Overview colour, from what a
 * forecast holds. A score the scans have not produced is left out.
 */
export function scoreLines(
  history: { facts: number | null; visibility: number | null; overall: number | null }[],
  scores: Record<"facts" | "visibility" | "overall", { points: { month: number; low: number; likely: number; high: number }[] } | null>,
): ScoreChartLine[] {
  const look = {
    overall: { label: "Overall", stroke: "stroke-ring-overall", fill: "fill-ring-overall", text: "text-ring-overall", dot: "bg-ring-overall" },
    visibility: { label: "Recommended by AI", stroke: "stroke-ring-visibility", fill: "fill-ring-visibility", text: "text-ring-visibility", dot: "bg-ring-visibility" },
    facts: { label: "Accuracy", stroke: "stroke-ring-facts", fill: "fill-ring-facts", text: "text-ring-facts", dot: "bg-ring-facts" },
  } as const;
  return (["overall", "visibility", "facts"] as const).flatMap(key => {
    const line = scores[key];
    return line ? [{
      key, ...look[key], past: history.map(h => h[key]),
      ahead: line.points.map(p => ({ label: `${p.month} months`, low: p.low, likely: p.likely, high: p.high })),
    }] : [];
  });
}

/**
 * Scores from 30 (the lowest a shown score can be) to 100, one line each: solid through the scans so far, then
 * dotted into the forecast on a tinted ground, with each forecast's range
 * shaded around it. The key underneath carries the numbers (today, then the
 * last forecast), so the chart itself stays clean. `compact` drops the past
 * dates for a small card.
 */
// Every shown score runs from 30 to 100, so the axis starts at 30: below it is space no score can reach.
const FLOOR = 30;

export function ScoreForecastChart({ lines, pastLabels, compact = false }: {
  lines: ScoreChartLine[];
  pastLabels: string[];
  compact?: boolean;
}) {
  const shown = lines.filter(l => l.past[l.past.length - 1] !== null && l.past[l.past.length - 1] !== undefined);
  if (shown.length === 0) return null;
  const W = 640, H = compact ? 150 : 230, left = 30, right = 16, top = 16, bottom = 30;
  const ahead = shown[0].ahead;
  const today = pastLabels.length - 1;
  // The forecast gets the wider part of the chart: it is what the page is about.
  const steps = today + ahead.length;
  const pastWidth = today === 0 ? 0 : (W - left - right) * Math.min(0.4, (today / steps) * 0.8);
  const x = (i: number) => i <= today
    ? left + (today === 0 ? 0 : (i / today) * pastWidth)
    : left + pastWidth + ((i - today) / ahead.length) * (W - left - right - pastWidth);
  const y = (v: number) => top + (1 - (Math.min(100, Math.max(FLOOR, v)) - FLOOR) / (100 - FLOOR)) * (H - top - bottom);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={shown.map(l => `${l.label}: ${l.past[today]} today, forecast ${l.ahead.map(p => `${p.likely} ${p.label} (${p.low} to ${p.high})`).join(", ")}`).join(". ")}>
        {/* The forecast's ground. */}
        <rect x={x(today)} y={top - 8} width={W - right - x(today) + 8} height={H - top - bottom + 8} rx={10} className="fill-bone" fillOpacity={0.55} />
        {[FLOOR, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={left} x2={W - right + 8} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} strokeOpacity={v === FLOOR ? 1 : 0.6} />
            <text x={left - 8} y={y(v) + 4} textAnchor="end" className="fill-muted" fontSize={11}>{v}</text>
          </g>
        ))}
        {!compact && pastLabels.slice(0, -1).map((l, i) => <text key={i} x={x(i)} y={H - 9} textAnchor={i === 0 ? "start" : "middle"} className="fill-muted" fontSize={11}>{l}</text>)}
        <text x={x(today)} y={H - 9} textAnchor={today === 0 ? "start" : "middle"} className="fill-ink-soft" fontSize={11} fontWeight={600}>Today</text>
        {ahead.map((p, n) => <text key={p.label} x={x(today + 1 + n)} y={H - 9} textAnchor={n === ahead.length - 1 ? "end" : "middle"} className="fill-muted" fontSize={11}>{p.label}</text>)}

        {shown.map(line => {
          const now = line.past[today] as number;
          const before = line.past.map((v, i) => [x(i), v] as const).filter((p): p is readonly [number, number] => p[1] !== null).map(([px, v]) => [px, y(v)] as [number, number]);
          const start: [number, number] = [x(today), y(now)];
          const at = (key: "low" | "likely" | "high") => [start, ...line.ahead.map((p, n) => [x(today + 1 + n), y(p[key])] as [number, number])];
          const likely = at("likely");
          const [endX, endY] = likely[likely.length - 1];
          return (
            <g key={line.key}>
              <path d={`${curve(at("high"))} ${curveBack(at("low"))} Z`} className={line.fill} fillOpacity={0.13} />
              <g className={line.stroke} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                {before.length > 1 && <path d={curve(before)} />}
                <path d={curve(likely)} strokeDasharray="1 7" />
              </g>
              <circle cx={start[0]} cy={start[1]} r={4.5} className={`${line.fill} stroke-paper`} strokeWidth={2} />
              <circle cx={endX} cy={endY} r={4.5} className={`fill-paper ${line.stroke}`} strokeWidth={2.5} />
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
        {shown.map(line => {
          const end = line.ahead[line.ahead.length - 1];
          return (
            <li key={line.key} className="flex items-center gap-2 text-[14px] text-ink-soft">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${line.dot}`} aria-hidden="true" />
              {line.label}
              <span className="tabular-nums text-ink">{line.past[today]}</span>
              <span className="text-muted" aria-hidden="true">→</span>
              <span className={`font-semibold tabular-nums ${line.text}`}>{end.likely}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * One growth figure as a small tile: its name, the number it reaches, its
 * range, and the curve it follows from today, with the range shaded.
 */
export function GrowthTile({ label, value, range, points, stroke, fill, children }: {
  label: string;
  value: string;
  range: string;
  /** The figure month by month from today. */
  points: { low: number; likely: number; high: number }[];
  stroke: string; fill: string;
  children?: ReactNode;
}) {
  const W = 200, H = 56, pad = 4;
  const max = Math.max(...points.map(p => p.high), 1e-9);
  const x = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  const line = (key: "low" | "likely" | "high") => points.map((p, i) => [x(i), y(p[key])] as [number, number]);
  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight text-ink">{value}</p>
      <p className="mt-1.5 text-[13px] text-ink-soft">{range}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" preserveAspectRatio="none" aria-hidden="true">
        <path d={`${curve(line("high"))} ${curveBack(line("low"))} Z`} className={fill} fillOpacity={0.16} />
        <path d={curve(line("likely"))} className={stroke} fill="none" strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {children}
    </div>
  );
}
