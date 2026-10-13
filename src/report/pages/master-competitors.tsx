import { Bar, EmptyState, PageTitle, ReportPage, ToolBadge, card, clamp, text, type PageProps } from "@/report/components";
import { sortedLeaderboard } from "@/report/scoring";
import { color, statusColor, toolMeta } from "@/report/tokens";
import type { AuditReport, GridCell } from "@/report/types";

/** Leaderboard rows and question rows that fit on the sheet (one question fewer with six AI tools across). */
const MAX_BOARD = 6;
const MAX_ROWS = 5;
const MAX_ROWS_NARROW = 4;

const ORDINAL = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
const ordinalPlace = (n: number) => (ORDINAL[n - 1] ? `${ORDINAL[n - 1]} place` : `number ${n} on the list`);
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/** Top entries that fit, always including the client. */
function boardRows(r: AuditReport) {
  const all = sortedLeaderboard(r.leaderboard);
  if (all.length <= MAX_BOARD) return all;
  const top = all.slice(0, MAX_BOARD);
  if (top.some((e) => e.isClient)) return top;
  const client = all.find((e) => e.isClient);
  return client ? [...all.slice(0, MAX_BOARD - 1), client] : top;
}

function leaderTakeaway(r: AuditReport, buyerAnswers: number): string {
  const all = sortedLeaderboard(r.leaderboard);
  const client = all.find((e) => e.isClient);
  const lead = all[0];
  if (!lead) return "No businesses were named in these answers.";
  if (!client || client.count === 0) return `${lead.name} was named in ${lead.count} of ${buyerAnswers} answers. You were not named in any.`;
  if (client.rank === 1) {
    const next = all[1];
    return `You were named in ${client.count} of ${buyerAnswers} answers, more than anyone else.` + (next ? ` ${next.name} was next with ${next.count}.` : "");
  }
  return `${lead.name} was named in ${lead.count} of ${buyerAnswers} answers. You were named in ${client.count}, ${ordinalPlace(client.rank)}.`;
}

function gridTakeaway(r: AuditReport): string {
  const you = r.business.name;
  const firsts = new Map<string, number>();
  let spots = 0;
  const clientFirst: { tool: string; q: string }[] = [];
  for (const q of r.questions) {
    for (const c of q.cells) {
      spots += 1;
      const name = c.clientRank === 1 ? you : c.firstNamed;
      if (name) firsts.set(name, (firsts.get(name) ?? 0) + 1);
      if (c.clientRank === 1) clientFirst.push({ tool: toolMeta[c.tool].name, q: q.text });
    }
  }
  if (!spots) return "No customer questions were asked in this scan.";
  const [leader, leaderCount] = [...firsts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  const lead = leader && leader !== you ? `${leader} was named first in ${leaderCount} of ${spots} spots.` : "";
  let mine: string;
  if (!clientFirst.length) mine = "You were not named first anywhere.";
  else if (clientFirst.length === 1) {
    const { tool, q } = clientFirst[0];
    mine = q.length <= 48 ? `You were first once: ${tool}, for “${q}”.` : `You were first once, on ${tool}.`;
  } else mine = leader === you ? `You were named first in ${clientFirst.length} of ${spots} spots, more than anyone.` : `You were first ${times(clientFirst.length)}.`;
  return [lead, mine].filter(Boolean).join(" ");
}

function cellView(c: GridCell | undefined, runs: number) {
  if (!c) return { first: "No answer", you: "", bg: color.surface, border: color.rule, youColor: color.muted };
  if (c.clientRank === 1) return { first: "You", you: `First, ${c.runsAppeared} of ${runs} runs`, bg: statusColor.good.soft, border: statusColor.good.soft, youColor: statusColor.good.text };
  if (c.clientRank && c.clientRank > 1) return { first: c.firstNamed, you: `You: number ${c.clientRank}`, bg: statusColor.warn.soft, border: statusColor.warn.soft, youColor: color.ink };
  return { first: c.firstNamed || "No one named", you: "You: left out", bg: color.panel, border: color.panel, youColor: statusColor.bad.text };
}

/** Page 3 of the full report: who AI recommends instead, overall and question by question. */
export function CompetitorsPage({ r, ctx }: PageProps) {
  const buyerAnswers = r.scan.buyerQuestionCount * r.scan.runsPerQuestion * r.scan.tools.length;
  const all = sortedLeaderboard(r.leaderboard);
  const board = boardRows(r);
  const client = all.find((e) => e.isClient);
  const lead = all[0];
  const above = client && client.rank > 1 ? all[client.rank - 2] : undefined;
  const second = all[1];

  const tools = r.scan.tools;
  const narrow = tools.length > 5;
  const rows = r.questions.slice(0, narrow ? MAX_ROWS_NARROW : MAX_ROWS);
  const hidden = r.questions.length - rows.length;

  return (
    <ReportPage r={r} ctx={ctx} section="Who AI recommends">
      <PageTitle eyebrow="Who AI recommends" title="The businesses AI names instead of you">
        {board.length ? leaderTakeaway(r, buyerAnswers) : undefined}
      </PageTitle>

      {board.length === 0 ? (
        <EmptyState title="No businesses named">None of the answers named a business, so there is no list this time.</EmptyState>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 12, alignItems: "stretch" }}>
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 9 }}>
            <span style={text.label}>Answers that named each business, out of {buyerAnswers}</span>
            {board.map((b) => (
              <div key={`${b.rank}-${b.name}`} style={{ display: "grid", gridTemplateColumns: "18px 150px 1fr 28px", gap: 10, alignItems: "center", fontSize: 13 }}>
                <span style={{ color: color.muted, fontSize: 12 }}>{b.rank}</span>
                <span style={{ fontWeight: 600, color: b.isClient ? color.clientText : color.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.isClient ? `You (${b.name})` : b.name}</span>
                <Bar pct={Math.max(b.count ? 2 : 0, b.barPct)} fill={b.isClient ? color.client : color.competitor} height={12} track={color.panel} />
                <span style={{ fontWeight: 600, textAlign: "right", color: b.isClient ? color.clientText : color.ink }}>{b.count}</span>
              </div>
            ))}
          </div>
          <div style={{ ...card, background: color.panel, borderColor: color.panel, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
            {client && client.rank === 1 ? (
              <>
                <span style={text.label}>Lead over second place</span>
                <span style={{ ...text.stat, fontSize: 44, color: color.clientText }}>{second ? client.count - second.count : client.count}</span>
                <span style={{ fontSize: 13, lineHeight: 1.4, color: color.body }}>{second ? `more answers named you than named ${second.name}.` : "answers named you, and no one else was named."}</span>
              </>
            ) : (
              <>
                <span style={text.label}>Gap to first place</span>
                <span style={{ ...text.stat, fontSize: 44, color: color.clientText }}>{lead.count - (client?.count ?? 0)}</span>
                <span style={{ fontSize: 13, lineHeight: 1.4, color: color.body }}>more answers named {lead.name} than named you.</span>
                {above && client && above.rank > 1 && (
                  <span style={text.small}>Passing {above.name} takes {above.count - client.count + 1} more.</span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ height: 1, background: color.rule }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={text.label}>Question by question</span>
          <p style={{ ...text.h2, fontWeight: 500, ...clamp(3) }}>{gridTakeaway(r)}</p>
        </div>
        {rows.length === 0 || tools.length === 0 ? (
          <EmptyState>No customer questions were asked in this scan, so there is no question by question table.</EmptyState>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: `${narrow ? 140 : 160}px repeat(${tools.length}, minmax(0, 1fr))`, gap: 4 }}>
              <span style={{ ...text.small, padding: "4px 0" }}>What a customer asked</span>
              {tools.map((t) => (
                <span key={t} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 2px", fontSize: narrow ? 10.5 : 12, fontWeight: 600, minWidth: 0 }}>
                  <ToolBadge tool={t} size={18} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{toolMeta[t].name}</span>
                </span>
              ))}
              {rows.map((q) => [
                <div key={`${q.id}-q`} style={{ padding: "4px 8px 4px 0", fontSize: 12.5, lineHeight: 1.3, color: color.ink, display: "flex", alignItems: "center" }}>
                  <span style={clamp(3)}>{q.text}</span>
                </div>,
                ...tools.map((t) => {
                  const c = cellView(q.cells.find((x) => x.tool === t), r.scan.runsPerQuestion);
                  return (
                    <div key={`${q.id}-${t}`} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: "6px 8px", display: "flex", flexDirection: "column", gap: 2, minHeight: 52, boxSizing: "border-box", justifyContent: "center", minWidth: 0 }}>
                      <span style={{ fontSize: narrow ? 11 : 12, fontWeight: 600, color: color.ink, lineHeight: 1.2, overflowWrap: "anywhere", ...clamp(2) }}>{c.first}</span>
                      {c.you && <span style={{ fontSize: narrow ? 10 : 11, fontWeight: 500, lineHeight: 1.25, color: c.youColor }}>{c.you}</span>}
                    </div>
                  );
                }),
              ])}
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: color.muted, flexWrap: "wrap", alignItems: "center" }}>
              <span>Each box shows who AI named first, and where you placed.</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: statusColor.good.soft }} />You were first</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: statusColor.warn.soft }} />You made the list</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: color.panel, border: `1px solid ${color.rule}` }} />You were left out</span>
              {hidden > 0 && <span style={{ fontWeight: 600 }}>Showing {rows.length} of {r.questions.length} questions.</span>}
            </div>
          </>
        )}
      </div>
    </ReportPage>
  );
}
