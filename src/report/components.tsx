/**
 * Shared building blocks for the report pages. Every page is a fixed US
 * Letter sheet (816 × 1056 CSS px) with inline styles, so the screen and the
 * PDF are the same thing. The look is the website's: ink on white, warm grey
 * rules, small uppercase labels, big semi-bold numbers, gold for the thing to
 * notice, red only for something wrong, green only for something right.
 */
import type { CSSProperties, ReactNode } from "react";
import type { AuditReport, Level, ToolId } from "@/report/types";
import type { Variant } from "@/report/scoring";
import { bandColors, bandLabel, levelLabel, rateBand, rateBandLabel, ringDash, scoreBand } from "@/report/scoring";
import { color, font, statusColor, toolMeta } from "@/report/tokens";

export interface PageCtx {
  variant: Variant;
  /** 1-based page number within the report. */
  index: number;
  total: number;
}

export interface PageProps {
  r: AuditReport;
  ctx: PageCtx;
}

export const VARIANT_LABEL: Record<Variant, string> = {
  master: "Full report",
  visibility: "Recommendations",
  factcheck: "Fact check",
  summary: "One-page summary",
};

/** The serif, for the "Mirror" wordmark and nothing else. */
export const FONT_DISPLAY = font.display;

/** "2026-09-24" -> "Sept 24, 2026". */
export function formatReportDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "A", "A and B", "A, B and C". */
export function joinNames(names: string[]): string {
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Shared text styles. */
export const text = {
  h1: { fontWeight: 600, fontSize: 28, lineHeight: 1.15, margin: 0, letterSpacing: "-0.02em", color: color.ink },
  h2: { fontWeight: 600, fontSize: 17, lineHeight: 1.3, margin: 0, letterSpacing: "-0.01em", color: color.ink },
  take: { fontSize: 15, fontWeight: 500, lineHeight: 1.45, margin: 0, color: color.body, textWrap: "pretty" },
  label: { fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: color.muted },
  body: { fontSize: 13.5, lineHeight: 1.5, margin: 0, color: color.body },
  small: { fontSize: 12, lineHeight: 1.45, color: color.muted },
  /** A big number. */
  stat: { fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1, color: color.ink },
} satisfies Record<string, CSSProperties>;

/** A white card with a hairline border. */
export const card: CSSProperties = { border: `1px solid ${color.rule}`, borderRadius: 16, background: color.surface, padding: "16px 18px" };
/** A soft ivory panel. */
export const panel: CSSProperties = { borderRadius: 16, background: color.panel, padding: "16px 18px" };

/** Clamp text to a number of lines. */
export const clamp = (lines: number) => ({ display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }) as const;

/** The "Mirror" wordmark, in the website's serif. */
export function Wordmark({ size = 20 }: { size?: number }) {
  return <span style={{ fontFamily: FONT_DISPLAY, fontSize: size, lineHeight: 1, letterSpacing: "0.01em", color: color.ink }}>Mirror</span>;
}

/**
 * One sheet: header (wordmark, report name | business · date), content
 * column, footer (section name | page N of total).
 */
export function ReportPage({
  r, ctx, section, children, gap = 18, continued = false,
}: {
  r: AuditReport;
  ctx: PageCtx;
  /** Footer left, e.g. "Who AI recommends". */
  section: string;
  children: ReactNode;
  gap?: number;
  /** A continuation sheet (e.g. the rest of a long list). */
  continued?: boolean;
}) {
  return (
    <div className="report-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 12, borderBottom: `1px solid ${color.rule}` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexShrink: 0 }}>
          <Wordmark />
          <span style={{ ...text.label, whiteSpace: "nowrap" }}>{VARIANT_LABEL[ctx.variant]}</span>
        </div>
        <span style={{ ...text.label, minWidth: 0, marginLeft: 24, display: "flex", gap: 6, whiteSpace: "nowrap" }}>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{r.business.name}</span>
          <span style={{ flexShrink: 0 }}>· {formatReportDate(r.scan.date)}</span>
        </span>
      </div>
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap, paddingTop: 24, minHeight: 0 }}>
        {children}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px solid ${color.rule}`, fontSize: 11, color: color.muted }}>
        <span>{section}{continued ? " (continued)" : ""}</span>
        <span style={{ fontWeight: 600, color: color.ink }}>{ctx.total > 1 ? `Page ${ctx.index} of ${ctx.total}` : ""}</span>
      </div>
    </div>
  );
}

/** The top of a page: a small label, the title, and one line that says what the page shows. */
export function PageTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ ...text.label, color: color.clientText }}>{eyebrow}</span>
      <h1 style={text.h1}>{title}</h1>
      {children && <p style={text.take}>{children}</p>}
    </div>
  );
}

export function Takeaway({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <p style={{ ...text.take, ...style }}>{children}</p>;
}

/** "What this means": an ivory panel with a gold rule down the left. */
export function NoteBox({ title = "What this means", children }: { title?: string; children: ReactNode }) {
  return (
    <div style={{ background: color.panel, borderLeft: `3px solid ${color.client}`, borderRadius: "4px 16px 16px 4px", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={text.label}>{title}</span>
      <div style={text.body}>{children}</div>
    </div>
  );
}

/**
 * Score ring: SVG circle with stroke-dasharray, starting at 12 o'clock.
 * `kind` picks the colour band: 0-100 scores or "named in X%" rates.
 * `strokeColor` forces a colour (grey for "not checked").
 */
export function ScoreRing({
  value, size, width, kind = "score", strokeColor, trackColor = color.track, children,
}: {
  value: number;
  size: number;
  width: number;
  kind?: "score" | "rate";
  strokeColor?: string;
  trackColor?: string;
  /** Center content; defaults to the number. */
  children?: ReactNode;
}) {
  const r = (size - width) / 2;
  const band = kind === "rate" ? rateBand(value) : scoreBand(value);
  const stroke = strokeColor ?? bandColors(band).fill;
  const c = size / 2;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={c} cy={c} r={r} fill="none" stroke={trackColor} strokeWidth={width} />
        {value > 0 && (
          <circle cx={c} cy={c} r={r} fill="none" strokeWidth={width} strokeLinecap="round" transform={`rotate(-90 ${c} ${c})`}
            style={{ stroke, strokeDasharray: ringDash(value, r) }} />
        )}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {children ?? <span style={{ ...text.stat, fontSize: Math.round(size * 0.3) }}>{value}</span>}
      </div>
    </div>
  );
}

/** A small rounded tag. */
export function Pill({ bg, fg, children, style }: { bg: string; fg: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, lineHeight: 1.3, padding: "3px 10px", borderRadius: 99, background: bg, color: fg, whiteSpace: "nowrap", ...style }}>
      {children}
    </span>
  );
}

/** Band tag under a score: "Needs work" / "Fair" / "Strong" (or "Weak" for rates). */
export function BandPill({ value, kind = "score", style }: { value: number; kind?: "score" | "rate"; style?: CSSProperties }) {
  const band = kind === "rate" ? rateBand(value) : scoreBand(value);
  const c = bandColors(band);
  return <Pill bg={c.tint} fg={c.text} style={style}>{kind === "rate" ? rateBandLabel[band] : bandLabel[band]}</Pill>;
}

/** "Low effort" and "High impact" tags for an action. Green marks the good end of each. */
export function EffortImpact({ effort, impact }: { effort: Level; impact: Level }) {
  const e = effort === "low" ? statusColor.good : statusColor.neutral;
  const i = impact === "high" ? statusColor.good : statusColor.neutral;
  return (
    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
      <Pill bg={e.tint} fg={e.text}>{levelLabel[effort]} effort</Pill>
      <Pill bg={i.tint} fg={i.text}>{levelLabel[impact]} impact</Pill>
    </span>
  );
}

/** Two-letter monogram for an AI tool (not the vendor's logo). */
export function ToolBadge({ tool, size = 20, radius }: { tool: ToolId; size?: number; radius?: number }) {
  const m = toolMeta[tool];
  return (
    <span aria-label={m.name} style={{ width: size, height: size, borderRadius: radius ?? Math.round(size * 0.3), background: m.color, color: color.surface, fontSize: Math.max(9, Math.round(size * 0.42)), fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {m.short}
    </span>
  );
}

/** A horizontal bar on a track. */
export function Bar({ pct, fill, height = 10, track = color.track }: { pct: number; fill: string; height?: number; track?: string }) {
  return (
    <div style={{ height, borderRadius: height / 2, background: track, overflow: "hidden" }}>
      <div style={{ height, borderRadius: height / 2, background: fill, width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

/** A numbered dot for ordered lists. Gold for the ones to do first. */
export function NumberDot({ n, tone = "ink", size = 26 }: { n: number; tone?: "ink" | "gold" | "muted"; size?: number }) {
  const bg = tone === "gold" ? color.client : tone === "muted" ? color.track : color.ink;
  const fg = tone === "muted" ? color.body : color.surface;
  return (
    <span style={{ flexShrink: 0, width: size, height: size, borderRadius: size / 2, background: bg, color: fg, fontSize: Math.round(size * 0.48), fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
  );
}

export function CheckIcon({ size = 13, stroke = color.surface }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function CrossIcon({ size = 12, stroke = color.surface }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12" /><path d="M18 6L6 18" />
    </svg>
  );
}

export function BangIcon({ size = 12, stroke = color.surface }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" aria-hidden="true">
      <path d="M12 6v7" /><path d="M12 17.5v.5" />
    </svg>
  );
}

/** Round status icon: a check for good, a mark for a warning, a cross for bad. */
export function StatusDot({ status, size = 24 }: { status: "good" | "warn" | "bad"; size?: number }) {
  return (
    <span style={{ flexShrink: 0, width: size, height: size, borderRadius: size / 2, background: statusColor[status].fill, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {status === "good" ? <CheckIcon size={size * 0.54} /> : status === "warn" ? <BangIcon size={size * 0.5} /> : <CrossIcon size={size * 0.5} />}
    </span>
  );
}

/** Empty-list state: a green box with a check (good news) or a dashed neutral box. */
export function EmptyState({ tone = "dashed", title, children }: { tone?: "good" | "dashed"; title?: string; children: ReactNode }) {
  if (tone === "good") {
    return (
      <div style={{ background: statusColor.good.soft, borderRadius: 16, padding: "32px 24px", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", textAlign: "center" }}>
        <StatusDot status="good" size={44} />
        {title && <span style={{ fontSize: 17, fontWeight: 600 }}>{title}</span>}
        <span style={{ ...text.small, maxWidth: 420, color: color.body }}>{children}</span>
      </div>
    );
  }
  return (
    <div style={{ border: `1px dashed ${color.muted}`, borderRadius: 16, padding: "20px", textAlign: "center", ...text.small }}>
      {title && <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: color.ink }}>{title}</p>}
      {children}
    </div>
  );
}
