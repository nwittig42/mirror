/**
 * Shared building blocks for the audit report pages. Every page is a fixed
 * US Letter sheet (816 × 1056 CSS px) and the styles are inline, copied from
 * the approved designs in docs/audit-design/design-source, so screen and PDF
 * match the design exactly.
 */
import type { CSSProperties, ReactNode } from "react";
import type { AuditReport, ToolId } from "@/report/types";
import type { Variant } from "@/report/scoring";
import { bandColors, bandLabel, rateBand, rateBandLabel, ringDash, scoreBand } from "@/report/scoring";
import { color, stageColor, statusColor, toolMeta } from "@/report/tokens";

export interface PageCtx {
  variant: Variant;
  /** 1-based page number within the variant. */
  index: number;
  total: number;
}

export interface PageProps {
  r: AuditReport;
  ctx: PageCtx;
}

export const VARIANT_LABEL: Record<Variant, string> = {
  master: "AI Visibility Audit",
  visibility: "AI Visibility Snapshot",
  factcheck: "AI Fact Check",
  summary: "AI Summary",
};

export const FONT_DISPLAY = "'Newsreader', Georgia, serif";

/** "2026-09-24" -> "Sept 24, 2026" (the design's date style). */
export function formatReportDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Shared text styles from the designs' <helmet> CSS. */
export const text = {
  h1: { fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: 34, lineHeight: 1.15, margin: 0, letterSpacing: "-0.01em" },
  take: { fontSize: 16, fontWeight: 700, lineHeight: 1.4, margin: 0, color: color.ink, textWrap: "balance" },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: color.subtle },
  small: { fontSize: 12, lineHeight: 1.45, color: color.subtle },
} satisfies Record<string, CSSProperties>;

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <rect width="22" height="22" rx="6" fill={color.client} />
      <path d="M10 5a6 6 0 0 0 0 12z" fill="#FFFFFF" />
      <path d="M12 5a6 6 0 0 1 0 12" fill="none" stroke="#FFFFFF" strokeWidth="1.6" />
    </svg>
  );
}

/**
 * One sheet: header (logo, "Mirror", variant label | business · date),
 * content column, footer (section name | N / total). Covers pass `bare` and
 * draw their own chrome, as the design does.
 */
export function ReportPage({
  r, ctx, section, children, gap = 18, bare = false, continued = false,
}: {
  r: AuditReport;
  ctx: PageCtx;
  /** Footer left, e.g. "08 · What AI gets wrong about you". */
  section: string;
  children: ReactNode;
  gap?: number;
  /** Cover pages: no header/footer, cover padding. */
  bare?: boolean;
  /** A continuation sheet (e.g. the rest of a long list). */
  continued?: boolean;
}) {
  if (bare) {
    return (
      <div className="report-page" style={{ padding: "56px 64px 0", position: "relative" }}>
        {children}
      </div>
    );
  }
  return (
    <div className="report-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: `1px solid ${color.rule}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Logo />
          <span style={{ fontSize: 15, fontWeight: 800 }}>Mirror</span>
          <span style={{ ...text.label, marginLeft: 6 }}>{VARIANT_LABEL[ctx.variant]}</span>
        </div>
        <span style={text.label}>{r.business.name} · {formatReportDate(r.scan.date)}</span>
      </div>
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap, paddingTop: 26, minHeight: 0 }}>
        {children}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px solid ${color.rule}`, fontSize: 11, color: color.subtle }}>
        <span>{section}{continued ? " (continued)" : ""}</span>
        <span style={{ fontWeight: 700, color: color.ink }}>{ctx.index} / {ctx.total}</span>
      </div>
    </div>
  );
}

export type Stage = keyof typeof stageColor;
export const STAGE_TEXT: Record<Stage, string> = {
  stand: "Where you stand",
  losing: "Who's beating you",
  wrong: "What AI gets wrong",
  fix: "What to fix",
  method: "How we measured",
};

export function StagePill({ stage, children }: { stage: Stage; children?: ReactNode }) {
  const c = stageColor[stage];
  return (
    <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 11px", borderRadius: 99, background: c.bg, color: c.fg }}>
      {children ?? STAGE_TEXT[stage]}
    </span>
  );
}

export function Takeaway({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <p style={{ ...text.take, ...style }}>{children}</p>;
}

/** "What this means": light blue box with an info icon. */
export function NoteBox({ title = "What this means", children }: { title?: string; children: ReactNode }) {
  return (
    <div style={{ background: color.clientSoft, borderRadius: 16, padding: "14px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color.clientText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.5v.5" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: color.clientText }}>{title}</span>
        <div style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: color.body }}>{children}</div>
      </div>
    </div>
  );
}

/**
 * Score ring: SVG circle with stroke-dasharray, rotated -90°, butt caps.
 * `kind` picks the color band: 0-100 scores or "named in X%" rates.
 * `stroke` color can be forced (e.g. client blue, competitor gray).
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
        <circle cx={c} cy={c} r={r} fill="none" strokeWidth={width} transform={`rotate(-90 ${c} ${c})`}
          style={{ stroke, strokeDasharray: ringDash(value, r) }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {children ?? <span style={{ fontSize: Math.round(size * 0.28), fontWeight: 800, lineHeight: 1 }}>{value}</span>}
      </div>
    </div>
  );
}

/** Band pill under a ring: "Needs work" / "Fair" / "Strong" (or "Weak" for rates). */
export function BandPill({ value, kind = "score", style }: { value: number; kind?: "score" | "rate"; style?: CSSProperties }) {
  const band = kind === "rate" ? rateBand(value) : scoreBand(value);
  const c = bandColors(band);
  return (
    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 99, background: c.tint, color: c.text, ...style }}>
      {kind === "rate" ? rateBandLabel[band] : bandLabel[band]}
    </span>
  );
}

/** Colored two-letter monogram for an AI tool (not the vendor's logo). */
export function ToolBadge({ tool, size = 20, radius }: { tool: ToolId; size?: number; radius?: number }) {
  const m = toolMeta[tool];
  return (
    <span aria-label={m.name} style={{ width: size, height: size, borderRadius: radius ?? Math.round(size * 0.3), background: m.color, color: "#FFFFFF", fontSize: Math.max(9, Math.round(size * 0.42)), fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {m.short}
    </span>
  );
}

/** Donut from a CSS conic-gradient (see `conicDonut`), with a white hole and centered content. */
export function Donut({ background, size, hole, children }: { background: string; size: number; hole: number; children?: ReactNode }) {
  return (
    <div style={{ position: "relative", width: size, height: size, borderRadius: "50%", background, flexShrink: 0 }}>
      <div style={{ position: "absolute", left: (size - hole) / 2, top: (size - hole) / 2, width: hole, height: hole, borderRadius: "50%", background: color.surface, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        {children}
      </div>
    </div>
  );
}

export function CheckIcon({ size = 13, stroke = "#FFFFFF" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function CrossIcon({ size = 12, stroke = "#FFFFFF" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12" /><path d="M18 6L6 18" />
    </svg>
  );
}

export function BangIcon({ size = 12, stroke = "#FFFFFF" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 6v7" /><path d="M12 17.5v.5" />
    </svg>
  );
}

/** Round status icon: ✓ good, ! warn, ✕ bad. */
export function StatusDot({ status, size = 24 }: { status: "good" | "warn" | "bad"; size?: number }) {
  const fill = status === "warn" ? statusColor.warn.strong : statusColor[status].fill;
  return (
    <span style={{ flexShrink: 0, width: size, height: size, borderRadius: size / 2, background: fill, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {status === "good" ? <CheckIcon size={size * 0.54} /> : status === "warn" ? <BangIcon size={size * 0.5} /> : <CrossIcon size={size * 0.5} />}
    </span>
  );
}

/** Empty-list state: green box with a check (good news) or a dashed neutral box. */
export function EmptyState({ tone = "dashed", title, children }: { tone?: "good" | "dashed"; title?: string; children: ReactNode }) {
  if (tone === "good") {
    return (
      <div style={{ background: statusColor.good.soft, borderRadius: 18, padding: "36px 24px", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", textAlign: "center" }}>
        <StatusDot status="good" size={48} />
        {title && <span style={{ fontSize: 17, fontWeight: 800 }}>{title}</span>}
        <span style={{ ...text.small, maxWidth: 420, color: color.muted }}>{children}</span>
      </div>
    );
  }
  return (
    <div style={{ border: `2px dashed ${color.rule}`, borderRadius: 16, padding: "22px 20px", textAlign: "center", ...text.small, color: color.muted }}>
      {title && <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: color.ink }}>{title}</p>}
      {children}
    </div>
  );
}

/** Two-digit section number, "08". */
export const nn = (n: number) => String(n).padStart(2, "0");
