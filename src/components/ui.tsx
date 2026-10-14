import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Building blocks for every signed-in screen (customer dashboard and admin),
 * in the website's look: white cards on ivory, ink text, gold for the thing to
 * notice, red only for something wrong, green only for something right.
 *
 * Colours come from the theme in globals.css (bg-ivory, text-ink, border-line
 * and so on). Do not write hex values in a page; add a tone here instead.
 */

export type Tone = "neutral" | "gold" | "flag" | "ok";

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-ink",
  gold: "text-gold",
  flag: "text-flag",
  ok: "text-ok",
};
const TONE_FILL: Record<Tone, string> = {
  neutral: "bg-ink",
  gold: "bg-gold",
  flag: "bg-flag",
  ok: "bg-ok",
};
const TONE_TAG: Record<Tone, string> = {
  neutral: "bg-bone text-ink-soft",
  gold: "bg-gold-soft text-gold",
  flag: "bg-flag-soft text-flag",
  ok: "bg-ok-soft text-ok",
};

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

/** The centred column every page sits in. */
export function PageBody({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={`mx-auto px-4 py-8 sm:px-6 ${wide ? "max-w-6xl" : "max-w-4xl"}`}>{children}</div>;
}

/** A white card with a small title. With `href` the whole card is a link. */
export function Card({ title, href, aside, children, className = "" }: {
  title?: string; href?: string; aside?: ReactNode; children: ReactNode; className?: string;
}) {
  const head = (title || aside) && (
    <div className="mb-3 flex items-center justify-between gap-3">
      {title && <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</h2>}
      {aside}
      {href && !aside && <span className="text-[17px] text-muted" aria-hidden="true">→</span>}
    </div>
  );
  const box = `block rounded-[20px] border border-line bg-paper p-5 ${className}`;
  return href
    ? <Link href={href} className={`${box} transition-colors hover:border-gold ${FOCUS}`}>{head}{children}</Link>
    : <section className={box}>{head}{children}</section>;
}

/** A big number with a small unit, like "12 of 40 answers". */
export function Stat({ value, unit, tone = "neutral" }: { value: ReactNode; unit?: string; tone?: Tone }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={`text-[40px] font-semibold leading-none tracking-tight ${TONE_TEXT[tone]}`}>{value}</span>
      {unit && <span className="text-[15px] text-muted">{unit}</span>}
    </div>
  );
}

/** The one line of grey text under a number or a title. */
export function Note({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[14px] leading-relaxed text-muted ${className}`}>{children}</p>;
}

export function Tag({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-semibold ${TONE_TAG[tone]}`}>{children}</span>;
}

const BUTTON = {
  primary: "bg-ink text-ivory hover:bg-ink-raised",
  gold: "bg-gold text-paper hover:brightness-110",
  outline: "border border-ink bg-transparent text-ink hover:bg-bone",
} as const;

export function buttonClass(variant: keyof typeof BUTTON = "primary"): string {
  return `inline-flex items-center justify-center whitespace-nowrap rounded-full px-5 py-2.5 text-[15px] font-semibold ${BUTTON[variant]} ${FOCUS}`;
}

/** A score out of 100 as one ring. Grey and "N/A" when there is no score yet. */
export function ScoreDial({ value, size = 148, label, color = "stroke-gold" }: {
  value: number | null; size?: number; label: string;
  /** The ring's colour, as a stroke class from the theme. */
  color?: string;
}) {
  const stroke = size * 0.09;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * Math.min(1, Math.max(0, (value ?? 0) / 100));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label} ${value ?? "not available"} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`} fill="none" strokeWidth={stroke}>
          <circle cx={size / 2} cy={size / 2} r={r} className="stroke-bone" />
          {(value ?? 0) > 0 && (
            <circle cx={size / 2} cy={size / 2} r={r} className={color} strokeLinecap="round" strokeDasharray={`${filled} ${circ - filled}`} />
          )}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-semibold leading-none tracking-tight text-ink" style={{ fontSize: size * 0.3 }}>{value ?? "N/A"}</span>
        {/* A small ring has no room for the label; the caller names it beside the ring. */}
        {size >= 120 && <span className="mt-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</span>}
      </div>
    </div>
  );
}

export type RingKey = "overall" | "visibility" | "facts";

const RING_STROKE: Record<RingKey, string> = {
  overall: "stroke-ring-overall",
  visibility: "stroke-ring-visibility",
  facts: "stroke-ring-facts",
};
const RING_TEXT: Record<RingKey, string> = {
  overall: "text-ring-overall",
  visibility: "text-ring-visibility",
  facts: "text-ring-facts",
};
const RING_DOT: Record<RingKey, string> = {
  overall: "bg-ring-overall",
  visibility: "bg-ring-visibility",
  facts: "bg-ring-facts",
};

export interface RingScore { key: RingKey; label: string; value: number | null; note?: string; /** Where the row in the key leads, when it leads anywhere. */ href?: string }

/**
 * Up to three scores as nested rings, outermost first, each on a faint track
 * of its own colour. A score of 0 shows as a dot at the top of its ring; a
 * missing score shows the empty track.
 */
export function ScoreRings({ rings, size = 184 }: { rings: RingScore[]; size?: number }) {
  const stroke = size * 0.1;
  const gap = size * 0.016;
  const c = size / 2;
  return (
    <div className="shrink-0" style={{ width: size, height: size }} role="img"
      aria-label={rings.map(r => `${r.label} ${r.value ?? "not available"} out of 100`).join(", ")}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <g transform={`rotate(-90 ${c} ${c})`} fill="none" strokeWidth={stroke}>
          {rings.map((ring, i) => {
            const r = (size - stroke) / 2 - i * (stroke + gap);
            const circ = 2 * Math.PI * r;
            const filled = circ * Math.min(1, Math.max(0, (ring.value ?? 0) / 100));
            return (
              <g key={ring.key} className={RING_STROKE[ring.key]}>
                <circle cx={c} cy={c} r={r} strokeOpacity={0.16} />
                {ring.value !== null && (
                  <circle cx={c} cy={c} r={r} strokeLinecap="round" strokeDasharray={`${Math.max(filled, 0.01)} ${circ}`} />
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

/** The numbers beside `ScoreRings`: one row per ring, in the ring's colour. A row with an `href` is a link to that score's page. */
export function RingLegend({ rings }: { rings: RingScore[] }) {
  return (
    <div className="space-y-1">
      {rings.map(ring => {
        const row = (
          <>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${RING_DOT[ring.key]}`} aria-hidden="true" />
                <span className="text-[15px] font-semibold text-ink">{ring.label}</span>
                {ring.href && <span className="text-[15px] text-muted group-hover:text-gold" aria-hidden="true">→</span>}
              </div>
              {ring.note && <Note className="mt-0.5 pl-[18px]">{ring.note}</Note>}
            </div>
            <div className="shrink-0 whitespace-nowrap">
              <span className={`text-[30px] font-semibold leading-none tracking-tight ${ring.value === null ? "text-muted" : RING_TEXT[ring.key]}`}>{ring.value ?? "N/A"}</span>
              {ring.value !== null && <span className="text-[15px] text-muted">/100</span>}
            </div>
          </>
        );
        const box = "-mx-2 flex items-center justify-between gap-4 rounded-xl px-2 py-1.5";
        return ring.href
          ? <Link key={ring.key} href={ring.href} className={`group ${box} hover:bg-bone ${FOCUS}`}>{row}</Link>
          : <div key={ring.key} className={box}>{row}</div>;
      })}
    </div>
  );
}

/** A labelled bar from 0 to 100 with its number at the end. */
export function Meter({ label, value, note, tone = "gold" }: { label: string; value: number | null; note?: string; tone?: Tone }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold text-ink">{label}</span>
        <span className={`text-[15px] font-semibold ${value === null ? "text-muted" : TONE_TEXT[tone]}`}>{value ?? "N/A"}{value !== null && <span className="text-muted">/100</span>}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-bone">
        <div className={`h-full rounded-full ${TONE_FILL[tone]}`} style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }} />
      </div>
      {note && <Note className="mt-1.5">{note}</Note>}
    </div>
  );
}

/** One score with how it moved since the last scan. */
export function TrendRow({ label, now, change }: { label: string; now: number | null; change: number | null }) {
  const up = change !== null && change > 0;
  const down = change !== null && change < 0;
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold ${up ? "bg-ok-soft text-ok" : down ? "bg-flag-soft text-flag" : "bg-bone text-muted"}`} aria-hidden="true">
        {up ? "↑" : down ? "↓" : "–"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-ink">{label}</div>
        <div className="text-[13px] text-muted">
          {change === null ? "Needs two scans to show a trend"
            : change === 0 ? "No change since the last scan"
            : `${up ? "Up" : "Down"} ${Math.abs(change)} since the last scan`}
        </div>
      </div>
      <span className="text-[20px] font-semibold text-ink">{now ?? "N/A"}</span>
    </div>
  );
}

/** Past scans as bars, oldest to newest, the latest in gold. */
export function HistoryBars({ points, label }: { points: { date: Date; value: number | null }[]; label: string }) {
  if (points.length === 0) return <Note>Your history starts with your first scan.</Note>;
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <div>
      <div className="flex h-32 items-end gap-2" role="img"
        aria-label={`${label}: ${points.map(p => `${fmt(p.date)} ${p.value ?? "N/A"}`).join(", ")}`}>
        {points.map((p, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end">
            <div className={`w-full rounded-t-md ${i === points.length - 1 ? "bg-gold" : "bg-gold-soft"}`}
              style={{ height: `${Math.max(3, p.value ?? 0)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[12px] text-muted">
        <span>{fmt(points[0].date)}</span>
        {points.length > 1 && <span>{fmt(points[points.length - 1].date)}</span>}
      </div>
    </div>
  );
}

/** A heading between groups of cards, with an optional line under it. `id` makes it a jump target. */
export function SectionTitle({ id, title, children }: { id?: string; title: string; children?: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24 pt-4">
      <h2 className="text-[22px] font-semibold tracking-tight text-ink">{title}</h2>
      {children && <Note className="mt-1">{children}</Note>}
    </div>
  );
}

/**
 * One row of a comparison list (use inside a <ul> or <ol>): a name, a bar
 * sized by `fraction` (0 to 1) and the count at the end. `highlight` is the
 * customer's own row, in bold. `fill` colours the bar (a background class
 * from the theme) and `icon` sits before the name.
 */
export function BarRow({ label, value, fraction, highlight = false, rank, fill, icon }: {
  label: ReactNode; value: ReactNode; fraction: number; highlight?: boolean; rank?: number; fill?: string; icon?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 text-[15px]">
      {rank !== undefined && <span className="w-6 shrink-0 tabular-nums text-muted">{rank}.</span>}
      <span className={`flex w-32 shrink-0 items-center gap-2 sm:w-56 ${highlight ? "font-semibold text-ink" : "text-ink-soft"}`}>
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className={`min-w-0 flex-1 overflow-hidden rounded-full bg-bone ${fill ? "h-3" : "h-2"}`}>
        <span className={`block h-full rounded-full ${fill ?? (highlight ? "bg-gold" : "bg-muted")}`}
          style={{ width: `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%` }} />
      </span>
      <span className="w-20 shrink-0 text-right text-[13px] tabular-nums text-muted sm:w-24">{value}</span>
    </li>
  );
}

/**
 * A website's own icon, by its address ("reddit.com"), from Google's public
 * icon service. Decorative: the name is always written beside it.
 */
export function SiteIcon({ domain, size = 20 }: { domain: string; size?: number }) {
  return (
    // A third-party address, so next/image has nothing to optimize.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`} alt="" loading="lazy"
      width={size} height={size} className="shrink-0 rounded-[5px] bg-white" style={{ width: size, height: size }} />
  );
}

const INITIAL_FILLS = ["bg-teal", "bg-plum", "bg-ring-facts", "bg-ring-visibility", "bg-ring-overall", "bg-sun"];

/**
 * A business's mark beside its name: its saved logo, else its website's
 * icon, else its first letter on a colour that stays the same for that name.
 */
export function BrandIcon({ name, domain, logo, size = 22 }: { name: string; domain?: string | null; logo?: string | null; size?: number }) {
  if (logo) {
    return (
      // A stored data: address, so next/image has nothing to optimize.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt="" width={size} height={size} className="shrink-0 rounded-[6px] bg-white object-contain" style={{ width: size, height: size }} />
    );
  }
  if (domain) return <SiteIcon domain={domain} size={size} />;
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return (
    <span aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.5 }}
      className={`flex shrink-0 items-center justify-center rounded-[6px] font-semibold leading-none text-paper ${INITIAL_FILLS[hash % INITIAL_FILLS.length]}`}>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

export interface BarPart { key: string; label: string; value: number; fill: string }

/**
 * One bar split into coloured parts sized by `value`, with a key under it.
 * `fill` is a background class from the theme (bg-gold, bg-ok and so on).
 */
export function SplitBar({ parts, unit, label }: { parts: BarPart[]; unit: string; label: string }) {
  const shown = parts.filter(p => p.value > 0);
  const total = shown.reduce((sum, p) => sum + p.value, 0);
  if (total === 0) return null;
  return (
    <div>
      <div className="flex h-4 gap-0.5 overflow-hidden rounded-full" role="img"
        aria-label={`${label}: ${shown.map(p => `${p.label} ${p.value} ${unit}`).join(", ")}`}>
        {shown.map(p => <span key={p.key} className={`h-full ${p.fill}`} style={{ width: `${(p.value / total) * 100}%` }} />)}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {shown.map(p => (
          <li key={p.key} className="flex items-center gap-2 text-[14px] text-ink-soft">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.fill}`} aria-hidden="true" />
            {p.label} <span className="tabular-nums text-muted">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface LineSeries { key: string; label: string; stroke: string; dot: string; points: (number | null)[] }

/**
 * Scores from 0 to 100 over time as one line each, with a key under the
 * chart. `labels` name the steps along the bottom. A step with no score
 * has no dot and the line passes over it; a lone score shows as a dot. `stroke` and `dot` are the
 * series' colour as a stroke class and a background class from the theme.
 */
export function LineChart({ series, labels, label }: { series: LineSeries[]; labels: string[]; label: string }) {
  const W = 640, H = 220, left = 34, right = 14, top = 12, bottom = 28;
  const x = (i: number) => left + (labels.length <= 1 ? (W - left - right) / 2 : (i * (W - left - right)) / (labels.length - 1));
  const y = (v: number) => top + (1 - Math.min(100, Math.max(0, v)) / 100) * (H - top - bottom);
  // A step with no score gets no dot; the line runs straight on to the next one that has.
  const path = (points: (number | null)[]) => points
    .map((v, i) => (v === null ? null : `${x(i).toFixed(1)} ${y(v).toFixed(1)}`))
    .filter(Boolean).map((xy, n) => `${n === 0 ? "M" : "L"}${xy}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={`${label}: ${series.map(s => `${s.label} ${s.points.map((v, i) => `${labels[i]} ${v ?? "none"}`).join(", ")}`).join("; ")}`}>
        {[0, 50, 100].map(v => (
          <g key={v}>
            <line x1={left} x2={W - right} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
            <text x={left - 8} y={y(v) + 4} textAnchor="end" className="fill-muted" fontSize={11}>{v}</text>
          </g>
        ))}
        {labels.map((l, i) => <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted" fontSize={11}>{l}</text>)}
        {series.map(s => (
          <g key={s.key} className={s.stroke} fill="none">
            <path d={path(s.points)} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            {s.points.map((v, i) => v === null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={4.5} className="fill-paper" strokeWidth={3} />)}
          </g>
        ))}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
        {series.map(s => (
          <li key={s.key} className="flex items-center gap-2 text-[14px] text-ink-soft">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} aria-hidden="true" />{s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Words quoted from an AI answer, with a gold rule down the side. */
export function Quote({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <blockquote className={`border-l-2 border-gold pl-4 text-[15px] leading-relaxed text-ink ${className}`}>{children}</blockquote>;
}

/**
 * A plain table for inside a card: small grey headings, a hairline between
 * rows. Columns whose index is in `right` hold numbers and align right.
 */
export function Table({ head, rows, right = [] }: { head: string[]; rows: ReactNode[][]; right?: number[] }) {
  const align = (i: number) => (right.includes(i) ? "text-right tabular-nums" : "text-left");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[15px]">
        <thead>
          <tr className="border-b border-line">
            {head.map((h, i) => (
              <th key={h} className={`py-2 pr-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted last:pr-0 ${align(i)}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((cells, r) => (
            <tr key={r}>
              {cells.map((cell, i) => (
                <td key={i} className={`py-2.5 pr-4 last:pr-0 ${i === 0 ? "text-ink" : "text-ink-soft"} ${align(i)}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
