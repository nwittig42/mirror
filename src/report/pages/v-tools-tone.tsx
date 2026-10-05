import { FONT_DISPLAY, EmptyState, ReportPage, nn, text, type PageProps } from "@/report/components";
import { bandColors, conicDonut, headlines, rateBandLabel, sortedTools, toneTotal } from "@/report/scoring";
import { toneColor, toolMeta } from "@/report/tokens";
import type { AuditReport } from "@/report/types";
import { VRing } from "@/report/pages/v-cover";

function toneLine(r: AuditReport): string {
  const t = r.tone;
  const total = toneTotal(t);
  if (!total) return "AI didn’t name you in any answer, so there’s no tone to measure yet.";
  const top = Math.max(t.recommended, t.justListed, t.mixed, t.warnedAgainst);
  const mood =
    t.recommended === top ? "mostly positive"
      : t.justListed === top ? "mostly neutral"
        : t.mixed === top ? "mostly mixed"
          : "often negative";
  const warn = t.warnedAgainst ? `${t.warnedAgainst} warn against you` : "none warn against you";
  return `When AI names you, it’s ${mood}: ${t.recommended} of ${total} answers recommend you, ${warn}.`;
}

export function VToolsTonePage({ r, ctx }: PageProps) {
  const tools = sortedTools(r.toolResults);
  const tone = [
    { name: "Recommended", count: r.tone.recommended, color: toneColor.recommended },
    { name: "Just listed", count: r.tone.justListed, color: toneColor.justListed },
    { name: "Mixed", count: r.tone.mixed, color: toneColor.mixed },
    { name: "Warned against", count: r.tone.warnedAgainst, color: toneColor.warnedAgainst },
  ];
  const total = toneTotal(r.tone);
  const donut = total ? conicDonut(tone.map((t) => ({ value: t.count, color: t.color })), 0.8) : "#E2E8F0";
  const quotes = [
    r.quotes.best && { label: "Best thing AI said", q: r.quotes.best, bg: "#F0FDF4", labelColor: "#15803D" },
    r.quotes.worst && { label: "Worst thing AI said", q: r.quotes.worst, bg: "#FFFBEB", labelColor: "#B45309" },
  ].filter((x) => !!x);

  return (
    <ReportPage r={r} ctx={ctx} section={`${nn(ctx.index)} · AI tool by tool`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 11px", borderRadius: 99, background: "#EDE9FE", color: "#6D28D9" }}>Who’s beating you</span>
        <h1 style={text.h1}>AI tool by tool</h1>
      </div>
      <p style={text.take}>{tools.length && tools.every((t) => t.named === 0) ? "None of the AI tools named you in these answers." : headlines(r).tools}</p>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(tools.length, 1)}, minmax(0, 1fr))`, gap: 10, paddingTop: 6 }}>
        {tools.map((t) => {
          const c = bandColors(t.band);
          const border = t.isBest ? "#16A34A" : t.isWorst ? "#FCA5A5" : "#E2E8F0";
          // 5 dots a row up to 30 answers; smaller dots for bigger scans so the card never grows past the sheet.
          const small = t.total > 30;
          const dot = small ? 6 : 10;
          const cols = small ? 10 : 5;
          return (
            <div key={t.tool} style={{ borderRadius: 16, border: `2px solid ${border}`, padding: "14px 10px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative" }}>
              {(t.isBest || t.isWorst) && (
                <span style={{ position: "absolute", top: -11, fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 99, background: t.isBest ? "#16A34A" : "#DC2626", color: "#FFFFFF" }}>{t.isBest ? "Best" : "Weakest"}</span>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, background: t.color, color: "#FFFFFF", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{t.short}</span>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{t.name}</span>
              </div>
              <VRing size={84} radius={34} width={10} value={t.pct} stroke={c.fill} track="#F1F5F9">
                <span style={{ fontSize: 20, fontWeight: 800 }}>{t.pct}%</span>
              </VRing>
              <span style={{ fontSize: 12.5 }}><strong>{t.named}</strong> of {t.total} answers</span>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${dot}px)`, gap: small ? 2 : 3 }} aria-hidden="true">
                {Array.from({ length: t.total }, (_, i) => (
                  <span key={i} style={{ width: dot, height: dot, borderRadius: small ? 2 : 3, background: i < t.named ? "#2563EB" : "#E2E8F0" }} />
                ))}
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 99, background: c.tint, color: c.text }}>{rateBandLabel[t.band]}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: "#475569", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "#2563EB" }} />Answer named you</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "#E2E8F0" }} />Didn’t name you</span>
        <span style={{ marginLeft: "auto" }}><strong style={{ color: "#15803D" }}>40%+ Strong</strong> · <strong style={{ color: "#B45309" }}>20–39% Fair</strong> · <strong style={{ color: "#B91C1C" }}>under 20% Weak</strong></span>
      </div>

      <div style={{ height: 1, background: "#E2E8F0", marginTop: 6 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={text.label}>How AI describes you</span>
        <p style={text.take}>{toneLine(r)}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "290px 1fr", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
            <div style={{ width: 130, height: 130, borderRadius: 65, background: donut }} />
            <div style={{ position: "absolute", left: 26, top: 26, width: 78, height: 78, borderRadius: 39, background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{total}</span>
              <span style={{ fontSize: 10, color: "#64748B" }}>mentions</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tone.map((t) => (
              <span key={t.name} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: t.color }} />{t.name} <span style={{ fontWeight: 800 }}>{t.count}</span>
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {quotes.map((q) => (
            <div key={q.label} style={{ background: q.bg, borderRadius: 16, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: q.labelColor }}>{q.label}</span>
              <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontStyle: "italic", fontSize: 16, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>“{q.q.text}”</p>
              <span style={text.small}>{toolMeta[q.q.tool].name}</span>
            </div>
          ))}
          {quotes.length === 0 && (
            <EmptyState>No quotes to show. AI didn’t describe you in any answer it gave.</EmptyState>
          )}
        </div>
      </div>
    </ReportPage>
  );
}
