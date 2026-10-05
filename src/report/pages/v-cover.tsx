import type { ReactNode } from "react";
import { FONT_DISPLAY, ReportPage, formatReportDate, text, type PageProps } from "@/report/components";
import { bandColors, bandLabel, ringDash, scoreBand } from "@/report/scoring";
import { color, toolMeta } from "@/report/tokens";

/**
 * Ring drawn exactly as the visibility designs do it: an explicit radius
 * inside a fixed box (the shared ScoreRing derives the radius from the box).
 */
export function VRing({
  size, radius, width, value, stroke, track = color.track, children,
}: {
  size: number;
  radius: number;
  width: number;
  value: number;
  stroke: string;
  track?: string;
  children?: ReactNode;
}) {
  const c = size / 2;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={c} cy={c} r={radius} fill="none" stroke={track} strokeWidth={width} />
        <circle cx={c} cy={c} r={radius} fill="none" strokeWidth={width} transform={`rotate(-90 ${c} ${c})`}
          style={{ stroke, strokeDasharray: ringDash(value, radius) }} />
      </svg>
      <div style={{ position: "absolute", left: 0, top: 0, width: size, height: size, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

/** "ChatGPT, Claude and Gemini". */
export function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function pageRange(a: number, b: number): string {
  return a === b ? `PAGE ${a}` : `PAGES ${a}–${b}`;
}

export function VCoverPage({ r, ctx }: PageProps) {
  const tools = r.scan.tools.map((t) => toolMeta[t]);
  const answers = r.scan.buyerQuestionCount * r.scan.runsPerQuestion * r.scan.tools.length;
  const score = r.scores.visibility;
  const band = scoreBand(score);
  const bc = bandColors(band);
  const i = ctx.index;
  const arc = [
    { pages: pageRange(i + 1, i + 1), title: "Where you stand", color: "#1D4ED8", bg: "#EFF6FF" },
    { pages: pageRange(i + 2, i + 3), title: "Who’s beating you, tool by tool", color: "#6D28D9", bg: "#F5F3FF" },
    { pages: pageRange(i + 4, i + 4), title: "Where AI looks and what to do", color: "#15803D", bg: "#F0FDF4" },
  ];
  const dot = <span style={{ width: 5, height: 5, borderRadius: 3, background: "#94A3B8" }} />;

  return (
    <ReportPage r={r} ctx={ctx} section="Cover" bare>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="40" height="40" viewBox="0 0 22 22" aria-hidden="true"><rect width="22" height="22" rx="6" fill="#2563EB" /><path d="M10 5a6 6 0 0 0 0 12z" fill="#FFFFFF" /><path d="M12 5a6 6 0 0 1 0 12" fill="none" stroke="#FFFFFF" strokeWidth="1.6" /></svg>
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Mirror</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 99, background: "#F1F5F9", color: "#334155" }}>Short report</span>
      </div>

      <div style={{ marginTop: 72, display: "flex", flexDirection: "column", gap: 16 }}>
        <span style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 99, background: "#DBEAFE", color: "#1D4ED8" }}>AI Visibility Snapshot</span>
        <h1 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: r.business.name.length > 22 ? 64 : 84, lineHeight: 1, letterSpacing: "-0.025em" }}>{r.business.name}</h1>
        <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 18, color: "#475569" }}>
          <span>{r.business.website}</span>
          {dot}
          <span>{r.business.location}</span>
          {dot}
          <span>Scanned {formatReportDate(r.scan.date)}</span>
        </div>
        <p style={{ margin: "6px 0 0", maxWidth: 560, fontFamily: FONT_DISPLAY, fontSize: 22, lineHeight: 1.4 }}>How often AI assistants recommend you, where you rank, and who they pick instead.</p>
      </div>

      <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "1fr 220px", gap: 20 }}>
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 20, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={text.label}>We asked these {tools.length} AI assistants</span>
          <div style={{ display: "flex", justifyContent: tools.length < 5 ? "space-around" : "space-between" }}>
            {tools.map((t) => (
              <div key={t.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 76 }}>
                <span style={{ width: 52, height: 52, borderRadius: 16, background: t.color, color: "#FFFFFF", fontSize: 19, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{t.short}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            <div style={{ background: "#FFFFFF", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "baseline", gap: 8 }}><span style={{ fontSize: 26, fontWeight: 800, color: "#2563EB" }}>{r.scan.buyerQuestionCount}</span><span style={{ fontSize: 13, color: "#475569" }}>buyer questions</span></div>
            <div style={{ background: "#FFFFFF", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "baseline", gap: 8 }}><span style={{ fontSize: 26, fontWeight: 800, color: "#7C3AED" }}>{r.scan.runsPerQuestion}×</span><span style={{ fontSize: 13, color: "#475569" }}>each</span></div>
            <div style={{ background: "#FFFFFF", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "baseline", gap: 8 }}><span style={{ fontSize: 26, fontWeight: 800, color: "#0D9488" }}>{answers}</span><span style={{ fontSize: 13, color: "#475569" }}>answers</span></div>
          </div>
        </div>
        <div style={{ border: "1px solid #E2E8F0", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span style={text.label}>Visibility score</span>
          <VRing size={136} radius={56} width={16} value={score} stroke={bc.fill} track="#F1F5F9">
            <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{score}</span>
            <span style={{ fontSize: 12, color: "#64748B" }}>of 100</span>
          </VRing>
          <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 99, background: bc.tint, color: bc.text }}>{bandLabel[band]}</span>
        </div>
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 14, color: "#475569" }}>
        Checked across {joinAnd(tools.map((t) => t.name))} · {r.scan.buyerQuestionCount} buyer questions · each asked {r.scan.runsPerQuestion === 1 ? "once" : `${r.scan.runsPerQuestion} times`}
      </p>

      <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={text.label}>Inside this snapshot</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          {arc.map((a) => (
            <div key={a.title} style={{ borderRadius: 14, padding: 14, background: a.bg, display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: a.color }}>{a.pages}</span>
              <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{a.title}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flexGrow: 1 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", fontSize: 12, color: "#64748B" }}>
        <span>Prepared for {r.business.name} by Mirror</span><span>Full details in the master report</span>
      </div>
      <div style={{ display: "flex", height: 14, margin: "0 -64px" }}>
        {tools.map((t) => <div key={t.name} style={{ flexGrow: 1, background: t.color }} />)}
      </div>
    </ReportPage>
  );
}
