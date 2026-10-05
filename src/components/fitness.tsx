import Link from "next/link";
import type { ReactNode } from "react";
import { RING_COLORS } from "@/components/score-rings";

/**
 * Building blocks for the customer dashboard, after Apple's Fitness app:
 * dark grey cards on black, titles in the metric's color, big numbers.
 */

export const METRIC_COLOR = {
  overall: RING_COLORS.overall.label,
  facts: RING_COLORS.facts.label,
  visibility: RING_COLORS.visibility.label,
  neutral: "#f5f5f7",
  warn: "#ff9f0a",
} as const;

export function Card({ title, color = METRIC_COLOR.neutral, href, children, className = "" }: {
  title: string; color?: string; href?: string; children: ReactNode; className?: string;
}) {
  const head = (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-[17px] font-semibold" style={{ color }}>{title}</h2>
      {href && <span className="text-[17px] text-[#636366]" aria-hidden="true">›</span>}
    </div>
  );
  const body = <>{head}{children}</>;
  const box = `block rounded-[20px] bg-[#1c1c1e] p-4 ${className}`;
  return href
    ? <Link href={href} className={`${box} transition-colors hover:bg-[#242426] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white`}>{body}</Link>
    : <section className={box}>{body}</section>;
}

/** A big value with a small grey unit, like "12/40 answers". */
export function BigValue({ value, unit, color = "#fff" }: { value: ReactNode; unit?: string; color?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[34px] font-bold leading-none tracking-tight" style={{ color }}>{value}</span>
      {unit && <span className="text-[15px] font-semibold text-[#8e8e93]">{unit}</span>}
    </div>
  );
}

/** One trend line: an arrow in a circle (colored when up, grey when down), the score and the change. */
export function TrendRow({ label, color, now, change }: { label: string; color: string; now: number | null; change: number | null }) {
  const up = change !== null && change > 0;
  const down = change !== null && change < 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[17px] font-bold"
        style={{ background: up ? color : "#3a3a3c", color: up ? "#000" : "#aeaeb2" }} aria-hidden="true">
        {up ? "↑" : down ? "↓" : "–"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-white">{label}</div>
        <div className="text-[13px] text-[#8e8e93]">
          {change === null ? "Needs two scans to show a trend"
            : change === 0 ? "No change since the last scan"
            : `${up ? "Up" : "Down"} ${Math.abs(change)} since the last scan`}
        </div>
      </div>
      <span className="text-[22px] font-bold" style={{ color }}>{now ?? "N/A"}</span>
    </div>
  );
}

/** Past scans as rounded bars, oldest to newest, like Fitness's history charts. */
export function HistoryBars({ points, color }: { points: { date: Date; value: number | null }[]; color: string }) {
  if (points.length === 0) return <p className="text-[15px] text-[#8e8e93]">Your history starts with your first scan.</p>;
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <div>
      <div className="flex h-36 items-end gap-2" role="img"
        aria-label={`Overall score by scan: ${points.map(p => `${fmt(p.date)} ${p.value ?? "N/A"}`).join(", ")}`}>
        {points.map((p, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end">
            <div className="w-full rounded-full"
              style={{ height: `${Math.max(4, p.value ?? 0)}%`, background: i === points.length - 1 ? color : `${color}66` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[12px] text-[#8e8e93]">
        <span>{fmt(points[0].date)}</span>
        {points.length > 1 && <span>{fmt(points[points.length - 1].date)}</span>}
      </div>
    </div>
  );
}
