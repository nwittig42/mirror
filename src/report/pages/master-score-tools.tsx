import { Bar, NoteBox, PageTitle, Pill, ReportPage, ScoreRing, ToolBadge, card, clamp, text, type PageProps } from "@/report/components";
import { bandColors, componentPoints, headlines, plainScoreNames, rateBandLabel, sortedTools } from "@/report/scoring";
import { color, statusColor } from "@/report/tokens";
import type { AuditReport, ScoreComponent } from "@/report/types";

/** What earning or losing a part's points means, in plain words. */
function partPhrase(id: ScoreComponent["id"], r: AuditReport): { earn: string; lose: string } {
  const reached = r.toolResults.filter((t) => t.named > 0).length;
  switch (id) {
    case "named_often": return { earn: "being named often", lose: "rarely being named" };
    case "rank_high": return { earn: "ranking high when you are named", lose: "sitting low on AI's lists" };
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
    : "You have not earned points yet.";
  const loseLine = lost[worst] > 0
    ? ` You lose the most points by ${partPhrase(comps[worst].id, r).lose}.`
    : " You are earning every point on offer.";
  return earnLine + loseLine;
}

function toolsNote(r: AuditReport): string {
  const tools = sortedTools(r.toolResults);
  const zero = tools.filter((t) => t.named === 0);
  const best = tools.find((t) => t.isBest);
  const parts = ["Each AI tool reads the web differently, so a business can be a regular on one and missing on another."];
  const googles = zero.filter((t) => t.tool === "gemini" || t.tool === "google");
  if (googles.length) {
    parts.push(`${googles.map((g) => g.name).join(" and ")} ${googles.length === 1 ? "leans" : "lean"} heavily on Google business listings, so fixing yours there is the fastest way off zero.`);
  } else if (zero.length) {
    parts.push(`Getting onto the review sites and directories ${zero.map((z) => z.name).join(" and ")} reads is the fastest way off zero.`);
  } else if (best) {
    parts.push(`${best.name} already names you most, so the sites it reads are the model for the rest.`);
  }
  return parts.join(" ");
}

/** Dot grid: one dot per answer. */
function waffle(total: number) {
  const cols = Math.max(5, Math.min(10, Math.ceil(total / 4)));
  const dot = total > 40 ? 6 : 9;
  return { cols, dot, gap: total > 40 ? 2 : 3 };
}

/** Page 2 of the full report: where the score comes from, then tool by tool. */
export function ScoreToolsPage({ r, ctx }: PageProps) {
  const comps = r.scores.components;
  const points = componentPoints(comps, r.scores.overall.value);
  const tools = sortedTools(r.toolResults);
  const many = tools.length > 5;

  return (
    <ReportPage r={r} ctx={ctx} section="Your score, and AI tool by AI tool">
      <PageTitle eyebrow="Where you stand" title="How your score is built">{scoreTakeaway(r, points)}</PageTitle>

      <div style={{ ...card, display: "grid", gridTemplateColumns: "150px 1fr", gap: 24, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <ScoreRing value={r.scores.overall.value} size={132} width={12}>
            <span style={{ ...text.stat, fontSize: 44 }}>{r.scores.overall.value}</span>
            <span style={{ fontSize: 11, color: color.muted, marginTop: 2 }}>of 100 points</span>
          </ScoreRing>
          <span style={text.label}>Overall</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {comps.map((c, i) => (
            <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 16, alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{c.label}</span>
                <span style={{ ...text.small, ...clamp(2) }}>{c.definition}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6, fontSize: 12, color: color.muted }}>
                  <span style={{ whiteSpace: "nowrap" }}><strong style={{ fontSize: 16, fontWeight: 600, color: color.ink }}>{points[i]}</strong> of {c.weight} points</span>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.detail}</span>
                </div>
                <Bar pct={c.weight ? (points[i] / c.weight) * 100 : 0} fill={color.client} height={8} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {(r.scores.overall.explanation || r.scan.coverageNote) && (
        <p style={{ ...text.small, margin: 0 }}>
          {plainScoreNames(r.scores.overall.explanation)}
          {r.scan.coverageNote && <strong style={{ fontWeight: 600, color: statusColor.warn.text }}> {r.scan.coverageNote}</strong>}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: `1px solid ${color.rule}`, paddingTop: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={text.label}>AI tool by AI tool</span>
          <p style={{ ...text.h2, fontWeight: 500 }}>{headlines(r).tools}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(tools.length, 1)}, minmax(0, 1fr))`, gap: many ? 8 : 10 }}>
          {tools.map((t) => {
            const w = waffle(t.total);
            const b = bandColors(t.band);
            return (
              <div key={t.tool} style={{ ...card, borderColor: t.isBest ? color.client : color.rule, padding: "14px 8px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative" }}>
                {(t.isBest || t.isWorst) && (
                  <Pill bg={t.isBest ? color.client : color.surface} fg={t.isBest ? color.surface : color.muted}
                    style={{ position: "absolute", top: -10, fontSize: 10, border: `1px solid ${t.isBest ? color.client : color.rule}` }}>
                    {t.isBest ? "Names you most" : "Names you least"}
                  </Pill>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <ToolBadge tool={t.tool} size={20} />
                  <span style={{ fontSize: many ? 11.5 : 13, fontWeight: 600 }}>{t.name}</span>
                </div>
                <ScoreRing value={t.pct} size={many ? 68 : 80} width={8} kind="rate">
                  <span style={{ ...text.stat, fontSize: many ? 17 : 20 }}>{t.pct}%</span>
                </ScoreRing>
                <span style={{ fontSize: 12, color: color.muted, textAlign: "center" }}><strong style={{ fontWeight: 600, color: color.ink }}>{t.named}</strong> of {t.total} answers</span>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${w.cols}, ${w.dot}px)`, gap: w.gap }} aria-hidden="true">
                  {Array.from({ length: t.total }, (_, i) => (
                    <span key={i} style={{ width: w.dot, height: w.dot, borderRadius: w.dot / 2, background: i < t.named ? color.client : color.track }} />
                  ))}
                </div>
                <Pill bg={b.tint} fg={b.text}>{rateBandLabel[t.band]}</Pill>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: color.muted, flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 5, background: color.client }} />Answer named you</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 5, background: color.track }} />Did not name you</span>
          <span style={{ marginLeft: "auto" }}>40% or more is strong · 20 to 39% is fair · under 20% is weak</span>
        </div>
      </div>

      <div style={{ marginTop: "auto" }}>
        <NoteBox>{toolsNote(r)}</NoteBox>
      </div>
    </ReportPage>
  );
}
