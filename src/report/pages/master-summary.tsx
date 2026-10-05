import { ReportPage, EmptyState, FONT_DISPLAY, nn, text, type PageProps } from "@/report/components";
import {
  bandColors, effortColor, factScoreView, impactColor, levelLabel, ringDash, scoreBand, sortedWrongFacts,
} from "@/report/scoring";
import type { AuditReport } from "@/report/types";

/** Ring with an explicit radius, as drawn in the design (the track sits inside the box). */
function Ring({ size, r, width, value, stroke, track }: { size: number; r: number; width: number; value: number; stroke: string; track: string }) {
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={c} cy={c} r={r} fill="none" stroke={track} strokeWidth={width} />
      <circle cx={c} cy={c} r={r} fill="none" strokeWidth={width} transform={`rotate(-90 ${c} ${c})`} style={{ stroke, strokeDasharray: ringDash(value, r) }} />
    </svg>
  );
}

/** One-line comparison of the client's visibility with the top competitor's. */
function compareLine(you: number, them: number, name: string): string {
  if (you <= 0) return them > 0 ? `${name} is visible to AI. You aren’t yet.` : `Neither you nor ${name} shows up much yet.`;
  const ratio = them / you;
  if (ratio >= 2.5) return `${name} is about ${Math.round(ratio)} times as visible as you.`;
  if (ratio >= 1.75) return `${name} is about twice as visible as you.`;
  if (ratio >= 1.15) return `${name} is more visible than you.`;
  if (ratio > 0.87) return `You and ${name} are about as visible as each other.`;
  return `You’re more visible than ${name}.`;
}

/**
 * Score markers above/below the scale bar. Labels go on top unless they would
 * collide with a label already there (within ~8 points), then below.
 */
function placePins(scores: { label: string; value: number }[]) {
  const top: { left: number; label: string }[] = [];
  const bottom: { left: number; label: string }[] = [];
  for (const s of scores) {
    const pin = { left: Math.max(5, Math.min(95, s.value)), label: `${s.label} ${s.value}` };
    const clashTop = top.some((p) => Math.abs(p.left - pin.left) < 9);
    if (!clashTop) top.push(pin);
    else bottom.push(pin);
  }
  return { top, bottom };
}

function meaning(r: AuditReport, clientRank: number | undefined, lowEffortFirst: boolean): string {
  const cat = r.business.category.toLowerCase();
  const wrong = sortedWrongFacts(r.facts);
  const parts: string[] = [];
  parts.push(clientRank === 1
    ? `When someone asks an AI assistant for a ${cat} nearby, you’re often one of the first names they hear.`
    : `When someone asks an AI assistant for a ${cat} nearby, they usually hear about other businesses first.`);
  if (wrong.length) parts.push(`When AI does mention you, it gets some facts wrong${wrong.some((f) => f.isPrice) ? ", including your price" : ""}.`);
  else if (r.facts.length) parts.push("When AI does mention you, it gets your facts right.");
  if (lowEffortFirst && parts.length < 2) parts.push("The first fixes are small and quick.");
  return parts.join(" ");
}

/** Page 2 of the master report: the executive summary. */
export function SummaryPage({ r, ctx }: PageProps) {
  const buyerAnswers = r.scan.buyerQuestionCount * r.scan.runsPerQuestion * r.scan.tools.length;
  const client = r.leaderboard.find((e) => e.isClient);
  const clientCount = client?.count ?? 0;
  const clientRank = client ? [...r.leaderboard].sort((a, b) => b.count - a.count).indexOf(client) + 1 : undefined;
  const { overall, visibility, factAccuracy } = r.scores;
  const trueCount = r.facts.filter((f) => f.isTrue).length;

  const tiles: { name: string; score: number | null; sub: string; def: string }[] = [
    {
      name: "Overall", score: overall.value,
      sub: overall.min === overall.max ? `The same across ${r.scan.runsPerQuestion} runs` : `Ranged ${overall.min}–${overall.max} across ${r.scan.runsPerQuestion} runs`,
      def: overall.explanation || "Visibility and accuracy combined.",
    },
    { name: "Visibility", score: visibility, sub: `Named in ${clientCount} of ${buyerAnswers} answers`, def: "How often and how high AI names you." },
    {
      name: "Fact accuracy", score: factAccuracy,
      sub: r.facts.length ? `${trueCount} of ${r.facts.length} facts correct` : "No facts checked yet",
      def: "How correct AI is about you.",
    },
  ];

  const pins = placePins([
    { label: "Overall", value: overall.value },
    ...(factAccuracy === null ? [] : [{ label: "Accuracy", value: factAccuracy }]),
    { label: "Visibility", value: visibility },
  ]);

  const compare = [
    { name: "You", score: visibility, named: `${clientCount} of ${buyerAnswers} answers` },
    { name: r.topCompetitor.name, score: r.topCompetitor.visibility, named: `${r.topCompetitor.namedCount} of ${buyerAnswers} answers` },
  ];

  const byId = new Map(r.actions.map((a) => [a.id, a]));
  const picked = r.topFixIds.map((id) => byId.get(id)).filter((a) => a !== undefined);
  const fixes = (picked.length ? picked : r.actions).slice(0, 3);

  const verdictLen = `${r.business.category} ${r.business.location} ${r.business.name} ${r.topCompetitor.name}`.length + 90;
  const pinStyle = { position: "absolute", top: 0, transform: "translateX(-50%)", fontSize: 11, fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap" } as const;

  return (
    <ReportPage r={r} ctx={ctx} section={`${nn(ctx.index)} · Executive summary`} gap={14}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 11px", borderRadius: 99, background: "#DBEAFE", color: "#1D4ED8" }}>Executive summary</span>
        <h1 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: verdictLen > 130 ? 26 : 29, lineHeight: 1.2, letterSpacing: "-0.01em", textWrap: "balance" }}>
          When people ask AI for a {r.business.category.toLowerCase()} in {r.business.location.split(",")[0]}, {r.business.name} comes up in{" "}
          <span style={{ color: "#B91C1C" }}>{clientCount} of {buyerAnswers} answers</span>. {r.topCompetitor.name} comes up in {r.topCompetitor.namedCount}.
        </h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
        {tiles.map((t) => {
          // Same colors and label as a band, or grey "N/A" when never checked.
          const v = factScoreView(t.score);
          const c = v.colors;
          return (
            <div key={t.name} style={{ borderRadius: 18, padding: "14px 14px", background: c.soft, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
              <span style={{ ...text.label, color: "#334155" }}>{t.name}</span>
              <div style={{ position: "relative", width: 108, height: 108 }}>
                <Ring size={108} r={44} width={13} value={v.ring} stroke={c.fill} track="#FFFFFF" />
                <div style={{ position: "absolute", left: 0, top: 0, width: 108, height: 108, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{v.shown}</span>
                  <span style={{ fontSize: 11, color: "#64748B" }}>of 100</span>
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99, background: c.fill, color: "#FFFFFF" }}>{v.label}</span>
              <span style={{ fontSize: 12.5, lineHeight: 1.35, fontWeight: 600 }}>{t.sub}</span>
              <span style={{ ...text.small, color: "#475569" }}>{t.def}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ position: "relative", height: 16 }}>
          {pins.top.map((p) => <span key={p.label} style={{ ...pinStyle, left: `${p.left}%` }}>{p.label} ▾</span>)}
        </div>
        <div style={{ display: "flex", gap: 3, height: 12 }} aria-hidden="true">
          <div style={{ flexGrow: 40, flexBasis: 0, background: "#DC2626", borderRadius: "6px 0 0 6px" }} />
          <div style={{ flexGrow: 30, flexBasis: 0, background: "#F59E0B" }} />
          <div style={{ flexGrow: 30, flexBasis: 0, background: "#16A34A", borderRadius: "0 6px 6px 0" }} />
        </div>
        <div style={{ position: "relative", height: 16 }}>
          {pins.bottom.map((p) => <span key={p.label} style={{ ...pinStyle, left: `${p.left}%` }}>▴ {p.label}</span>)}
        </div>
        <div style={{ display: "flex", fontSize: 11.5, fontWeight: 700 }}>
          <span style={{ flexGrow: 40, flexBasis: 0, color: "#B91C1C" }}>0–39 · Needs work</span>
          <span style={{ flexGrow: 30, flexBasis: 0, color: "#B45309" }}>40–69 · Fair</span>
          <span style={{ flexGrow: 30, flexBasis: 0, color: "#15803D", textAlign: "right" }}>70–100 · Strong</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20 }}>
        <div style={{ border: "1px solid #E2E8F0", borderRadius: 18, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={text.label}>You vs. your top competitor</span>
          <p style={text.take}>{compareLine(visibility, r.topCompetitor.visibility, r.topCompetitor.name)}</p>
          <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
            {compare.map((c) => (
              <div key={c.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
                <div style={{ position: "relative", width: 80, height: 80 }}>
                  <Ring size={80} r={32} width={10} value={c.score} stroke={bandColors(scoreBand(c.score)).fill} track="#F1F5F9" />
                  <div style={{ position: "absolute", left: 0, top: 0, width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800 }}>{c.score}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, maxWidth: 130 }}>{c.name}</span>
                <span style={text.small}>{c.named}</span>
              </div>
            ))}
          </div>
          <span style={text.small}>Visibility score. Fact accuracy is only checked for you.</span>
        </div>

        <div style={{ border: "1px solid #E2E8F0", borderRadius: 18, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={text.label}>{fixes.length === 0 ? "Things to fix" : `Top ${fixes.length === 1 ? "thing" : `${fixes.length} things`} to fix`}</span>
          {fixes.length === 0 && <EmptyState>No fixes needed right now.</EmptyState>}
          {fixes.map((f, i) => {
            const e = effortColor(f.effort);
            const im = impactColor(f.impact);
            return (
              <div key={f.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 10, background: "#2563EB", color: "#FFFFFF", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>{f.title}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: e.tint, color: e.text }}>{levelLabel[f.effort]} effort</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: im.tint, color: im.text }}>{levelLabel[f.impact]} impact</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: "#EFF6FF", borderRadius: 16, padding: "14px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.5v.5" /></svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#1D4ED8" }}>What this means</span>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#1E293B" }}>{meaning(r, clientRank, fixes[0]?.effort === "low")}</p>
        </div>
      </div>
    </ReportPage>
  );
}
