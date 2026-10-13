import {
  Bar, EffortImpact, EmptyState, NoteBox, NumberDot, Pill, ReportPage, ScoreRing, ToolBadge, card, clamp, formatReportDate, text,
  type PageProps,
} from "@/report/components";
import { factScoreView, sortedLeaderboard, sortedWrongFacts } from "@/report/scoring";
import { color, statusColor, toolMeta } from "@/report/tokens";
import type { AuditReport } from "@/report/types";

/** One line comparing how often the business and its top competitor are named. */
function compareLine(you: number, them: number, name: string): string {
  if (you <= 0) return them > 0 ? `AI names ${name}. It does not name you yet.` : `Neither you nor ${name} comes up much yet.`;
  const ratio = them / you;
  if (ratio >= 2.5) return `AI names ${name} about ${Math.round(ratio)} times as often as you.`;
  if (ratio >= 1.75) return `AI names ${name} about twice as often as you.`;
  if (ratio >= 1.15) return `AI names ${name} more often than you.`;
  if (ratio > 0.87) return `AI names you and ${name} about as often as each other.`;
  return `AI names you more often than ${name}.`;
}

function meaning(r: AuditReport, clientRank: number | undefined): string {
  const cat = r.business.category.toLowerCase();
  const wrong = sortedWrongFacts(r.facts);
  const parts: string[] = [];
  parts.push(clientRank === 1
    ? `When someone asks an AI assistant for a ${cat} nearby, you are often one of the first names they hear.`
    : `When someone asks an AI assistant for a ${cat} nearby, they usually hear about other businesses first.`);
  if (wrong.length) parts.push(`When AI does mention you, it gets some facts wrong${wrong.some((f) => f.isPrice) ? ", including your price" : ""}.`);
  else if (r.facts.length) parts.push("When AI does mention you, it gets your facts right.");
  parts.push("The pages that follow show where you stand and what to change first.");
  return parts.join(" ");
}

/** Page 1 of the full report: who it is for, the three scores, you against the top competitor, and the first fixes. */
export function OverviewPage({ r, ctx }: PageProps) {
  const { tools, buyerQuestionCount, brandedQuestionCount, runsPerQuestion: runs } = r.scan;
  const buyerAnswers = buyerQuestionCount * runs * tools.length;
  const questions = buyerQuestionCount + brandedQuestionCount;
  const board = sortedLeaderboard(r.leaderboard);
  const client = board.find((e) => e.isClient);
  const clientCount = client?.count ?? 0;
  const comp = r.topCompetitor;
  const max = Math.max(1, clientCount, comp.namedCount);
  const { overall, visibility, factAccuracy } = r.scores;
  const trueCount = r.facts.filter((f) => f.isTrue).length;
  const city = r.business.location.split(",")[0];

  const tiles: { name: string; score: number | null; sub: string }[] = [
    {
      name: "Overall", score: overall.value,
      sub: overall.min === overall.max ? "Your two scores below, combined." : `Ranged from ${overall.min} to ${overall.max} across ${runs} runs.`,
    },
    { name: "Recommended by AI", score: visibility, sub: `Named in ${clientCount} of ${buyerAnswers} answers.` },
    { name: "Accuracy", score: factAccuracy, sub: r.facts.length ? `${trueCount} of ${r.facts.length} facts correct.` : "No facts checked yet." },
  ];

  const byId = new Map(r.actions.map((a) => [a.id, a]));
  const picked = r.topFixIds.map((id) => byId.get(id)).filter((a) => a !== undefined);
  const fixes = (picked.length ? picked : r.actions).slice(0, 3);

  return (
    <ReportPage r={r} ctx={ctx} section="Overview" gap={18}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ ...text.label, color: color.clientText }}>What AI tells your customers</span>
        <h1 style={{ ...text.h1, fontSize: r.business.name.length > 26 ? 30 : 40, lineHeight: 1.1, textWrap: "balance", ...clamp(2) }}>{r.business.name}</h1>
        <div style={{ fontSize: 13.5, color: color.muted }}>
          {[r.business.website, r.business.location, `Checked ${formatReportDate(r.scan.date)}`].filter(Boolean).join("  ·  ")}
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 18, fontWeight: 500, lineHeight: 1.4, color: color.ink, textWrap: "pretty" }}>
        When people ask AI for a {r.business.category.toLowerCase()} in {city}, {r.business.name} comes up in{" "}
        <strong style={{ fontWeight: 600, color: color.clientText }}>{clientCount} of {buyerAnswers} answers</strong>. {comp.name} comes up in {comp.namedCount}.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        {tiles.map((t) => {
          const v = factScoreView(t.score);
          return (
            <div key={t.name} style={{ ...card, padding: "14px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <ScoreRing value={v.ring} size={84} width={8} strokeColor={v.colors.fill}>
                <span style={{ ...text.stat, fontSize: t.score === null ? 18 : 28 }}>{v.shown}</span>
                {t.score !== null && <span style={{ fontSize: 10, color: color.muted, marginTop: 2 }}>of 100</span>}
              </ScoreRing>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5, minWidth: 0 }}>
                <span style={text.label}>{t.name}</span>
                <Pill bg={v.colors.tint} fg={v.colors.text}>{v.label}</Pill>
                <span style={{ ...text.small, ...clamp(3) }}>{t.sub}</span>
              </div>
            </div>
          );
        })}
      </div>
      {r.scan.coverageNote && <p style={{ ...text.small, margin: 0, color: statusColor.warn.text, fontWeight: 600 }}>{r.scan.coverageNote}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 12 }}>
        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={text.label}>You and the business AI names most</span>
          <p style={{ ...text.h2, fontSize: 15, ...clamp(3) }}>{compareLine(clientCount, comp.namedCount, comp.name)}</p>
          {[{ who: "You", n: clientCount, you: true }, { who: comp.name, n: comp.namedCount, you: false }].map((b) => (
            <div key={b.who} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.who}</span>
                <span style={{ color: color.muted, whiteSpace: "nowrap" }}><strong style={{ fontWeight: 600, color: b.you ? color.clientText : color.ink }}>{b.n}</strong> of {buyerAnswers} answers</span>
              </div>
              <Bar pct={Math.max(2, (b.n / max) * 100)} fill={b.you ? color.client : color.competitor} height={12} track={color.panel} />
            </div>
          ))}
        </div>

        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={text.label}>{fixes.length === 1 ? "The first thing to fix" : "The first things to fix"}</span>
          {fixes.length === 0 && <EmptyState>Nothing needs fixing right now.</EmptyState>}
          {fixes.map((f, i) => (
            <div key={f.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <NumberDot n={i + 1} tone="gold" size={22} />
              <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, ...clamp(2) }}>{f.title}</span>
                <EffortImpact effort={f.effort} impact={f.impact} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={text.label}>How we checked</span>
        <span style={{ display: "inline-flex", gap: 6 }}>
          {tools.map((t) => <ToolBadge key={t} tool={t} size={24} />)}
        </span>
        <span style={text.small}>
          {tools.length} AI {tools.length === 1 ? "tool" : "tools"} ({tools.map((t) => toolMeta[t].name).join(", ")}), {questions} {questions === 1 ? "question" : "questions"}, each asked {runs === 1 ? "once" : `${runs} times`}.
        </span>
      </div>

      <div style={{ marginTop: "auto" }}>
        <NoteBox>{meaning(r, client?.rank)}</NoteBox>
      </div>
    </ReportPage>
  );
}
