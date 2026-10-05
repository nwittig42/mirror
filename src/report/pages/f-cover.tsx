import { ReportPage, FONT_DISPLAY, text, formatReportDate, type PageProps } from "@/report/components";
import { factScoreView, ringDash } from "@/report/scoring";
import { color, statusColor, toolMeta } from "@/report/tokens";

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function FCoverPage({ r, ctx }: PageProps) {
  const fs = factScoreView(r.scores.factAccuracy);
  const bc = fs.colors;
  const R = 56;

  const checked = r.facts.length;
  const right = r.facts.filter((f) => f.isTrue).length;
  const wrong = checked - right;
  const stats = [
    { n: checked, label: checked === 1 ? "fact checked" : "facts checked", icon: "?", color: color.client },
    { n: right, label: "AI got right", icon: "✓", color: statusColor.good.fill },
    { n: wrong, label: "AI got wrong", icon: "✕", color: statusColor.bad.fill },
  ];

  const toolNames = r.scan.tools.map((t) => toolMeta[t].name);
  const q = r.scan.brandedQuestionCount;
  const runs = r.scan.runsPerQuestion;

  const arc = [
    { offset: 1, title: "True or false: every fact checked", color: "#15803D", bg: "#F0FDF4" },
    { offset: 2, title: "What AI gets wrong, and where it read it", color: "#B91C1C", bg: "#FEF2F2" },
    { offset: 3, title: "How to fix it", color: "#1D4ED8", bg: "#EFF6FF" },
  ];

  return (
    <ReportPage r={r} ctx={ctx} section="Cover" bare>
      <div style={{ flexGrow: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width="40" height="40" viewBox="0 0 22 22" aria-hidden="true">
              <rect width="22" height="22" rx="6" fill="#2563EB" />
              <path d="M10 5a6 6 0 0 0 0 12z" fill="#FFFFFF" />
              <path d="M12 5a6 6 0 0 1 0 12" fill="none" stroke="#FFFFFF" strokeWidth="1.6" />
            </svg>
            <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Mirror</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 99, background: color.track, color: color.text2 }}>Fact check report</span>
        </div>

        <div style={{ marginTop: 72, display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 99, background: "#DCFCE7", color: "#15803D" }}>AI Fact Check</span>
          <h1 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: r.business.name.length > 32 ? 48 : r.business.name.length > 16 ? 64 : 84, lineHeight: 1, letterSpacing: "-0.025em", textWrap: "balance" }}>{r.business.name}</h1>
          <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 18, color: color.muted, flexWrap: "wrap" }}>
            <span>{r.business.website}</span>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: "#94A3B8" }} />
            <span>{r.business.location}</span>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: "#94A3B8" }} />
            <span>Scanned {formatReportDate(r.scan.date)}</span>
          </div>
          <p style={{ margin: "6px 0 0", maxWidth: 560, fontFamily: FONT_DISPLAY, fontSize: 22, lineHeight: 1.4 }}>What AI assistants say about your prices, hours and services: what’s true, what’s false, and where the mistakes come from.</p>
        </div>

        <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "1fr 220px", gap: 20 }}>
          <div style={{ background: color.panel, border: `1px solid ${color.rule}`, borderRadius: 20, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 18 }}>
            <span style={text.label}>At a glance</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {stats.map((s) => (
                <div key={s.label} style={{ background: "#FFFFFF", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                  <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 17, background: s.color, color: "#FFFFFF", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</span>
                  <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{s.n}</span>
                  <span style={{ fontSize: 13, color: color.muted }}>{s.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              {r.scan.tools.map((t) => {
                const m = toolMeta[t];
                return (
                  <span key={t} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px 3px 3px", borderRadius: 99, background: "#FFFFFF", fontSize: 12, fontWeight: 700 }}>
                    <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 11, background: m.color, color: "#FFFFFF", fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{m.short}</span>
                    {m.name}
                  </span>
                );
              })}
            </div>
          </div>
          <div style={{ border: `1px solid ${color.rule}`, borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <span style={text.label}>Fact accuracy</span>
            <div style={{ position: "relative", width: 136, height: 136 }}>
              <svg width="136" height="136" viewBox="0 0 136 136" aria-hidden="true">
                <circle cx="68" cy="68" r={R} fill="none" stroke={color.track} strokeWidth="16" />
                <circle cx="68" cy="68" r={R} fill="none" strokeWidth="16" transform="rotate(-90 68 68)" style={{ stroke: bc.fill, strokeDasharray: ringDash(fs.ring, R) }} />
              </svg>
              <div style={{ position: "absolute", left: 0, top: 0, width: 136, height: 136, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{fs.shown}</span>
                <span style={{ fontSize: 12, color: color.subtle }}>of 100</span>
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 99, background: bc.tint, color: bc.text }}>{fs.label}</span>
          </div>
        </div>
        <p style={{ margin: "14px 0 0", fontSize: 14, color: color.muted }}>
          Checked across {listJoin(toolNames)} · {q} question{q === 1 ? "" : "s"} about you by name · each asked {runs} time{runs === 1 ? "" : "s"}
        </p>

        <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={text.label}>Inside this report</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {arc.map((a) => (
              <div key={a.offset} style={{ borderRadius: 14, padding: 14, background: a.bg, display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: a.color }}>PAGE {ctx.index + a.offset}</span>
                <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{a.title}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flexGrow: 1 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", fontSize: 12, color: color.subtle }}>
          <span>Prepared for {r.business.name} by Mirror</span>
          <span>Full details in the master report</span>
        </div>
        <div aria-hidden="true" style={{ display: "flex", height: 14, margin: "0 -64px" }}>
          {checked === 0 || right > 0 ? <div style={{ flexGrow: checked ? right : 1, background: statusColor.good.fill }} /> : null}
          {wrong > 0 && <div style={{ flexGrow: wrong, background: statusColor.bad.fill }} />}
        </div>
      </div>
    </ReportPage>
  );
}
