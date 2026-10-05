import { ReportPage, nn, text, type PageProps } from "@/report/components";
import {
  bandColors, componentPoints, conicDonut, headlines, rateBandLabel, ringDash, scoreBand, sortedTools,
} from "@/report/scoring";
import type { AuditReport, ScoreComponent } from "@/report/types";

/** Component colors: blue, violet, teal, orange. */
const PART_COLOR: Record<ScoreComponent["id"], string> = {
  named_often: "#2563EB",
  rank_high: "#7C3AED",
  tool_reach: "#0D9488",
  accuracy: "#E8590C",
};
const PART_FALLBACK = ["#2563EB", "#7C3AED", "#0D9488", "#E8590C"];

/** What earning / losing a component's points means, in plain words. */
function partPhrase(id: ScoreComponent["id"], r: AuditReport): { earn: string; lose: string } {
  const reached = r.toolResults.filter((t) => t.named > 0).length;
  switch (id) {
    case "named_often": return { earn: "being named often", lose: "rarely being named" };
    case "rank_high": return { earn: "ranking high when you’re named", lose: "sitting low on AI’s lists" };
    case "tool_reach": return { earn: `being on ${reached} of ${r.scan.tools.length} AI tools`, lose: "missing from some AI tools" };
    case "accuracy": return { earn: "AI getting your facts right", lose: "AI getting facts about you wrong" };
    default: return { earn: "this part of the score", lose: "this part of the score" };
  }
}

function scoreTakeaway(r: AuditReport, points: number[]): string {
  const comps = r.scores.components;
  if (!comps.length) return `Your score is ${r.scores.overall.value} of 100.`;
  const best = points.reduce((bi, p, i) => (p > points[bi] ? i : bi), 0);
  const lost = comps.map((c, i) => c.weight - points[i]);
  const worst = lost.reduce((wi, l, i) => (l > lost[wi] ? i : wi), 0);
  const total = r.scores.overall.value;
  const earnLine = points[best] > 0
    ? `Your ${total} comes mostly from ${partPhrase(comps[best].id, r).earn}.`
    : `You haven’t earned points yet.`;
  const loseLine = lost[worst] > 0
    ? ` You lose the most points by ${partPhrase(comps[worst].id, r).lose}.`
    : " You’re earning every point on offer.";
  return earnLine + loseLine;
}

function toolsNote(r: AuditReport): string {
  const tools = sortedTools(r.toolResults);
  const zero = tools.filter((t) => t.named === 0);
  const best = tools.find((t) => t.isBest);
  const parts = ["Each assistant reads the web differently, so a business can be a regular on one and missing on another."];
  if (zero.some((t) => t.tool === "gemini")) {
    parts.push("Gemini leans heavily on Google’s business listings, so fixing yours there is the fastest way off zero.");
  } else if (zero.length) {
    parts.push(`Getting onto the review sites and directories ${zero.map((z) => z.name).join(" and ")} reads is the fastest way off zero.`);
  } else if (best) {
    parts.push(`${best.name} already names you most, so the sites it reads are the model for the rest.`);
  }
  return parts.join(" ");
}

/** Waffle layout: 5 columns for the usual 15 answers, wider for more. */
function waffle(total: number) {
  const cols = Math.max(5, Math.min(10, Math.ceil(total / 4)));
  const dot = total > 40 ? 7 : 10;
  return { cols, dot, gap: total > 40 ? 2 : 3 };
}

/** Page 3 of the master report: how the score is built, and tool by tool. */
export function ScoreToolsPage({ r, ctx }: PageProps) {
  const comps = r.scores.components;
  const points = componentPoints(comps, r.scores.overall.value);
  const parts = comps.map((c, i) => {
    const b = bandColors(scoreBand(c.score));
    return {
      id: c.id, name: c.label, def: c.definition, weight: c.weight, pts: points[i], detail: c.detail,
      color: PART_COLOR[c.id] ?? PART_FALLBACK[i % PART_FALLBACK.length],
      fill: c.weight ? Math.round((points[i] / c.weight) * 100) : 0,
      bandBg: b.tint, bandFg: b.text,
    };
  });
  const donut = conicDonut(parts.map((p) => ({ value: p.pts, color: p.color })), 0.6, "#E9EEF4");

  const tools = sortedTools(r.toolResults).map((t) => {
    const b = bandColors(t.band);
    return {
      ...t,
      ringColor: b.fill, bandBg: b.tint, bandFg: b.text, bandText: rateBandLabel[t.band],
      tag: t.isBest ? "Best" : t.isWorst ? "Weakest" : "",
      tagBg: t.isBest ? "#16A34A" : "#DC2626",
      border: t.isBest ? "#16A34A" : t.isWorst ? "#FCA5A5" : "#E2E8F0",
    };
  });

  return (
    <ReportPage r={r} ctx={ctx} section={`${nn(ctx.index)} · How your score is built · AI tool by tool`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 11px", borderRadius: 99, background: "#DBEAFE", color: "#1D4ED8" }}>Where you stand</span>
        <h1 style={text.h1}>How your score is built</h1>
      </div>

      <p style={text.take}>{scoreTakeaway(r, points)}</p>
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 28, alignItems: "center" }}>
        <div style={{ position: "relative", width: 200, height: 200 }}>
          <div style={{ width: 200, height: 200, borderRadius: 100, background: donut }} />
          <div style={{ position: "absolute", left: 34, top: 34, width: 132, height: 132, borderRadius: 66, background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 48, fontWeight: 800, lineHeight: 1 }}>{r.scores.overall.value}</span>
            <span style={{ fontSize: 12, color: "#64748B" }}>of 100 points</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {parts.map((p) => (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "14px 1fr 180px", gap: 12, alignItems: "center" }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: p.color }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</span>
                <span style={text.small}>{p.def}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 13, whiteSpace: "nowrap" }}><strong style={{ fontSize: 16 }}>{p.pts}</strong> of {p.weight} pts</span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 7px", borderRadius: 99, background: p.bandBg, color: p.bandFg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.detail}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "#F1F5F9" }}><div style={{ height: 8, borderRadius: 4, background: p.color, width: `${p.fill}%` }} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {r.scores.overall.explanation && <p style={{ ...text.small, margin: 0, color: "#334155" }}>{r.scores.overall.explanation}</p>}
      {r.scan.coverageNote && <p style={{ ...text.small, margin: 0, color: "#B45309", fontWeight: 700 }}>{r.scan.coverageNote}</p>}

      <div style={{ height: 1, background: "#E2E8F0" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={text.label}>AI tool by tool</span>
        <p style={text.take}>{headlines(r).tools}</p>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(tools.length, 1)}, minmax(0, 1fr))`, gap: 10 }}>
          {tools.map((t) => {
            const w = waffle(t.total);
            return (
              <div key={t.tool} style={{ borderRadius: 16, border: `2px solid ${t.border}`, padding: "14px 10px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative" }}>
                {t.tag && <span style={{ position: "absolute", top: -11, fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 99, background: t.tagBg, color: "#FFFFFF" }}>{t.tag}</span>}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, background: t.color, color: "#FFFFFF", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{t.short}</span>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{t.name}</span>
                </div>
                <div style={{ position: "relative", width: 84, height: 84 }}>
                  <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
                    <circle cx="42" cy="42" r="34" fill="none" stroke="#F1F5F9" strokeWidth="10" />
                    <circle cx="42" cy="42" r="34" fill="none" strokeWidth="10" transform="rotate(-90 42 42)" style={{ stroke: t.ringColor, strokeDasharray: ringDash(t.pct, 34) }} />
                  </svg>
                  <div style={{ position: "absolute", left: 0, top: 0, width: 84, height: 84, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800 }}>{t.pct}%</div>
                </div>
                <span style={{ fontSize: 12.5 }}><strong>{t.named}</strong> of {t.total} answers</span>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${w.cols}, ${w.dot}px)`, gap: w.gap }} aria-hidden="true">
                  {Array.from({ length: t.total }, (_, i) => (
                    <span key={i} style={{ width: w.dot, height: w.dot, borderRadius: 3, background: i < t.named ? "#2563EB" : "#E2E8F0" }} />
                  ))}
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 99, background: t.bandBg, color: t.bandFg }}>{t.bandText}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: "#475569", flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "#2563EB" }} />Answer named you</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "#E2E8F0" }} />Didn’t name you</span>
          <span style={{ marginLeft: "auto" }}><strong style={{ color: "#15803D" }}>40%+ Strong</strong> · <strong style={{ color: "#B45309" }}>20–39% Fair</strong> · <strong style={{ color: "#B91C1C" }}>under 20% Weak</strong></span>
        </div>
      </div>

      <div style={{ background: "#EFF6FF", borderRadius: 16, padding: "14px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.5v.5" /></svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#1D4ED8" }}>What this means</span>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#1E293B" }}>{toolsNote(r)}</p>
        </div>
      </div>
    </ReportPage>
  );
}
