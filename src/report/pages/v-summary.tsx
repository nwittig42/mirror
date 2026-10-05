import { FONT_DISPLAY, ReportPage, nn, text, type PageProps } from "@/report/components";
import {
  actionsFor, bandColors, bandLabel, effortColor, impactColor, levelLabel, pct, rateBand, rateBandLabel,
  scoreBand, sortedLeaderboard, sortedTools,
} from "@/report/scoring";
import { toolMeta } from "@/report/tokens";
import type { AuditReport } from "@/report/types";
import { VRing, joinAnd } from "@/report/pages/v-cover";

/** Does the top competitor top the "named first" count across the grid? */
function competitorUsuallyFirst(r: AuditReport): boolean {
  const counts = new Map<string, number>();
  for (const q of r.questions) {
    for (const c of q.cells) {
      if (c.clientRank === 1) continue;
      counts.set(c.firstNamed, (counts.get(c.firstNamed) ?? 0) + 1);
    }
  }
  const mine = counts.get(r.topCompetitor.name) ?? 0;
  return mine > 0 && [...counts.values()].every((n) => n <= mine);
}

/** "Skin Bar LA is about twice as visible as you." */
function compareLine(name: string, them: number, you: number): string {
  if (you <= 0) return them > 0 ? `${name} is far more visible than you.` : `Neither of you is visible yet.`;
  const ratio = them / you;
  if (ratio >= 3.5) return `${name} is several times as visible as you.`;
  if (ratio >= 2.5) return `${name} is about three times as visible as you.`;
  if (ratio >= 1.75) return `${name} is about twice as visible as you.`;
  if (ratio >= 1.15) return `${name} is more visible than you.`;
  if (ratio > 0.87) return `You and ${name} are about equally visible.`;
  return `You are more visible than ${name}.`;
}

export function VSummaryPage({ r, ctx }: PageProps) {
  const answers = r.scan.buyerQuestionCount * r.scan.runsPerQuestion * r.scan.tools.length;
  const lb = sortedLeaderboard(r.leaderboard);
  const me = lb.find((e) => e.isClient);
  const myCount = me?.count ?? 0;
  const comp = r.topCompetitor;
  const compRank = lb.find((e) => !e.isClient && e.name === comp.name)?.rank;

  const tools = sortedTools(r.toolResults);
  const naming = tools.filter((t) => t.named > 0).length;
  const zero = tools.filter((t) => t.named === 0).map((t) => toolMeta[t.tool].name);
  const namedPct = pct(myCount, answers);
  const reachPct = pct(naming, tools.length);

  const tile = (kind: "score" | "rate", v: number) => {
    const b = kind === "score" ? scoreBand(v) : rateBand(v);
    const c = bandColors(b);
    return { soft: c.soft, color: c.fill, label: kind === "score" ? bandLabel[b] : rateBandLabel[b] };
  };
  const tiles = [
    { name: "Visibility score", big: String(r.scores.visibility), unit: "of 100", sub: "How often and how high AI names you", value: r.scores.visibility, ...tile("score", r.scores.visibility) },
    { name: "Answers naming you", big: `${namedPct}%`, unit: `${myCount} of ${answers}`, sub: namedPct < 50 ? "Most buyers never hear your name" : "Most buyers hear your name", value: namedPct, ...tile("rate", namedPct) },
    {
      name: "AI tools naming you", big: `${naming}/${tools.length}`, unit: "assistants",
      sub: zero.length === 0 ? "Every assistant named you at least once" : zero.length === tools.length ? "No assistant named you yet" : `Only ${joinAnd(zero)} never named you`,
      value: reachPct, ...tile("rate", reachPct),
    },
  ];

  const compare = [
    { name: "You", score: r.scores.visibility, named: `${me ? `Rank #${me.rank} · ` : ""}${myCount} answers` },
    { name: comp.name, score: comp.visibility, named: `${compRank ? `Rank #${compRank} · ` : ""}${comp.namedCount} answers` },
  ];

  // Five rows; if you're further down, keep the top four and add your row.
  let board = lb.slice(0, 5);
  if (me && me.rank > 5) board = [...lb.slice(0, 4), me];

  const moves = actionsFor("visibility", r).slice(0, 3);

  return (
    <ReportPage r={r} ctx={ctx} section={`${nn(ctx.index)} · Summary`} gap={16}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 11px", borderRadius: 99, background: "#DBEAFE", color: "#1D4ED8" }}>Where you stand</span>
        <h1 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: 29, lineHeight: 1.2, letterSpacing: "-0.01em", textWrap: "balance" }}>
          AI names {r.business.name} in <span style={{ color: "#B91C1C" }}>{myCount} of {answers}</span> buyer answers.{" "}
          {comp.name} is named in {comp.namedCount}{competitorUsuallyFirst(r) ? ", and it’s usually named first." : "."}
        </h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
        {tiles.map((t) => (
          <div key={t.name} style={{ borderRadius: 18, padding: 14, background: t.soft, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
            <span style={{ ...text.label, color: "#334155" }}>{t.name}</span>
            <VRing size={124} radius={50} width={14} value={t.value} stroke={t.color} track="#FFFFFF">
              <span style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{t.big}</span>
              <span style={{ fontSize: 11, color: "#64748B" }}>{t.unit}</span>
            </VRing>
            <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99, background: t.color, color: "#FFFFFF" }}>{t.label}</span>
            <span style={{ fontSize: 12.5, lineHeight: 1.35, fontWeight: 600 }}>{t.sub}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20 }}>
        <div style={{ border: "1px solid #E2E8F0", borderRadius: 18, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={text.label}>You vs. your top competitor</span>
          <p style={text.take}>{compareLine(comp.name, comp.visibility, r.scores.visibility)}</p>
          <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
            {compare.map((c) => (
              <div key={c.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, maxWidth: 130, textAlign: "center" }}>
                <VRing size={92} radius={37} width={11} value={c.score} stroke={bandColors(scoreBand(c.score)).fill} track="#F1F5F9">
                  <span style={{ fontSize: 28, fontWeight: 800 }}>{c.score}</span>
                </VRing>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</span>
                <span style={text.small}>{c.named}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ border: "1px solid #E2E8F0", borderRadius: 18, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={text.label}>Who AI names most</span>
          {board.map((b) => {
            const mine = b.isClient;
            return (
              <div key={`${b.rank}-${b.name}`} style={{ display: "grid", gridTemplateColumns: "22px 92px 1fr 26px", gap: 8, alignItems: "center" }}>
                <span style={{ width: 22, height: 22, borderRadius: 11, background: mine ? "#2563EB" : "#0F172A", color: "#FFFFFF", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{b.rank}</span>
                <span style={{ fontSize: 13, fontWeight: mine ? 800 : 600, color: mine ? "#1D4ED8" : "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={b.name}>{mine ? "You" : b.name}</span>
                <div style={{ height: 12, borderRadius: 4, background: "#F1F5F9" }}><div style={{ height: 12, borderRadius: 4, background: mine ? "#2563EB" : "#CBD5E1", width: `${b.barPct}%` }} /></div>
                <span style={{ fontSize: 13, fontWeight: 800, textAlign: "right" }}>{b.count}</span>
              </div>
            );
          })}
          {board.length === 0 && <span style={text.small}>No businesses were named in these answers.</span>}
          <span style={text.small}>Answers naming each business, out of {answers}.</span>
        </div>
      </div>

      {moves.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={text.label}>Top {moves.length === 1 ? "move" : `${moves.length} moves`} to get named more</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
            {moves.map((m, i) => {
              const e = effortColor(m.effort);
              const im = impactColor(m.impact);
              return (
                <div key={m.id} style={{ background: "#F8FAFC", borderRadius: 16, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 10, background: "#2563EB", color: "#FFFFFF", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.title}</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: "auto" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: e.tint, color: e.text }}>{levelLabel[m.effort]} effort</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: im.tint, color: im.text }}>{levelLabel[m.impact]} impact</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ReportPage>
  );
}
