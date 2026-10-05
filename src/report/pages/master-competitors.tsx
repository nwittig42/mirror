import { ReportPage, EmptyState, nn, text, type PageProps } from "@/report/components";
import { sortedLeaderboard } from "@/report/scoring";
import { toolMeta } from "@/report/tokens";
import type { AuditReport, GridCell } from "@/report/types";

/** Leaderboard columns that fit side by side; heatmap rows that fit under them. */
const MAX_COLUMNS = 6;
const MAX_ROWS = 5;

const ORDINAL = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
const ordinalPlace = (n: number) => (ORDINAL[n - 1] ? `${ORDINAL[n - 1]} place` : `#${n} on the list`);
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/** Top entries that fit, always including the client. */
function boardRows(r: AuditReport) {
  const all = sortedLeaderboard(r.leaderboard);
  if (all.length <= MAX_COLUMNS) return all;
  const top = all.slice(0, MAX_COLUMNS);
  if (top.some((e) => e.isClient)) return top;
  const client = all.find((e) => e.isClient);
  return client ? [...all.slice(0, MAX_COLUMNS - 1), client] : top;
}

function leaderTakeaway(r: AuditReport, buyerAnswers: number): string {
  const all = sortedLeaderboard(r.leaderboard);
  const client = all.find((e) => e.isClient);
  const lead = all[0];
  if (!lead) return "No businesses were named in these answers.";
  if (!client || client.count === 0) return `${lead.name} was named in ${lead.count} of ${buyerAnswers} answers. You weren’t named in any.`;
  if (client.rank === 1) {
    const next = all[1];
    return `You were named in ${client.count} of ${buyerAnswers} answers, more than anyone else.` + (next ? ` ${next.name} was next with ${next.count}.` : "");
  }
  return `${lead.name} was named in ${lead.count} of ${buyerAnswers} answers. You were named in ${client.count}, ${ordinalPlace(client.rank)}.`;
}

function heatTakeaway(r: AuditReport): string {
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
  if (!spots) return "No buyer questions were asked in this scan.";
  const [leader, leaderCount] = [...firsts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  const lead = leader && leader !== you ? `${leader} was named first in ${leaderCount} of ${spots} spots.` : "";
  let mine: string;
  if (!clientFirst.length) mine = "You weren’t named first anywhere.";
  else if (clientFirst.length === 1) {
    const { tool, q } = clientFirst[0];
    mine = q.length <= 48 ? `You were first once: ${tool}, for “${q}”.` : `You were first once, on ${tool}.`;
  } else mine = leader === you ? `You were named first in ${clientFirst.length} of ${spots} spots, more than anyone.` : `You were first ${times(clientFirst.length)}.`;
  return [lead, mine].filter(Boolean).join(" ");
}

function cellView(c: GridCell | undefined, runs: number) {
  if (!c) return { first: "No answer", you: "", bg: "#F1F5F9", fg: "#475569", youColor: "#475569" };
  if (c.clientRank === 1) return { first: "You ★", you: `First · ${c.runsAppeared} of ${runs} runs`, bg: "#16A34A", fg: "#FFFFFF", youColor: "#FFFFFF" };
  if (c.clientRank && c.clientRank > 1) return { first: c.firstNamed, you: `You #${c.clientRank} · ${c.runsAppeared}/${runs}`, bg: "#FDE68A", fg: "#0F172A", youColor: "#92400E" };
  return { first: c.firstNamed, you: "You: left out", bg: "#FEE2E2", fg: "#0F172A", youColor: "#B91C1C" };
}

const clamp = (lines: number) => ({ display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }) as const;

/** Page 4 of the master report: who AI recommends instead. */
export function CompetitorsPage({ r, ctx }: PageProps) {
  const buyerAnswers = r.scan.buyerQuestionCount * r.scan.runsPerQuestion * r.scan.tools.length;
  const all = sortedLeaderboard(r.leaderboard);
  const max = all[0]?.count || 1;
  const board = boardRows(r).map((e) => ({
    ...e,
    label: e.isClient ? "You" : e.name,
    h: Math.max(36, Math.round((e.count / max) * 150)),
    color: e.isClient ? "#2563EB" : "#CBD5E1",
    valColor: e.isClient ? "#1D4ED8" : "#0F172A",
    nameColor: e.isClient ? "#1D4ED8" : "#0F172A",
    weight: e.isClient ? 800 : 600,
  }));

  const client = all.find((e) => e.isClient);
  const lead = all[0];
  const above = client && client.rank > 1 ? all[client.rank - 2] : undefined;
  const second = all[1];

  const tools = r.scan.tools.map((t) => ({ id: t, ...toolMeta[t] }));
  const rows = r.questions.slice(0, MAX_ROWS);
  const hidden = r.questions.length - rows.length;

  return (
    <ReportPage r={r} ctx={ctx} section={`${nn(ctx.index)} · Who AI recommends instead`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 11px", borderRadius: 99, background: "#EDE9FE", color: "#6D28D9" }}>Who’s beating you</span>
        <h1 style={text.h1}>Who AI recommends instead</h1>
      </div>

      {board.length === 0 ? (
        <EmptyState title="No businesses named">None of the buyer answers named a business, so there is no leaderboard this time.</EmptyState>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 210px", gap: 24, alignItems: "end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={text.take}>{leaderTakeaway(r, buyerAnswers)}</p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 190, borderBottom: "2px solid #0F172A", padding: "0 8px" }}>
              {board.map((b) => (
                <div key={`${b.rank}-${b.name}`} style={{ flexGrow: 1, flexBasis: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: b.valColor }}>{b.count}</span>
                  <div style={{ width: "100%", height: b.h, background: b.color, borderRadius: "8px 8px 0 0", display: "flex", justifyContent: "center", paddingTop: 8, boxSizing: "border-box" }}>
                    <span style={{ width: 24, height: 24, borderRadius: 12, background: "#FFFFFF", color: "#0F172A", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{b.rank}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, padding: "0 8px" }}>
              {board.map((b) => (
                <span key={`${b.rank}-${b.name}`} style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, textAlign: "center", fontSize: 12.5, fontWeight: b.weight, color: b.nameColor, overflowWrap: "anywhere", ...clamp(2) }}>{b.label}</span>
              ))}
            </div>
          </div>
          <div style={{ background: "#EFF6FF", borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {client && client.rank === 1 ? (
              <>
                <span style={{ ...text.label, color: "#1D4ED8" }}>Lead over second place</span>
                <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, color: "#1D4ED8" }}>{second ? client.count - second.count : client.count}</span>
                <span style={{ fontSize: 13, lineHeight: 1.4 }}>{second ? `more answers named you than named ${second.name}.` : "answers named you, and no one else was named."}</span>
              </>
            ) : (
              <>
                <span style={{ ...text.label, color: "#1D4ED8" }}>Gap to first place</span>
                <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, color: "#1D4ED8" }}>{lead.count - (client?.count ?? 0)}</span>
                <span style={{ fontSize: 13, lineHeight: 1.4 }}>more answers named {lead.name} than named you.</span>
                {above && client && above.rank > 1 && (
                  <span style={{ ...text.small, color: "#475569" }}>
                    Passing {above.name} (#{above.rank}) takes {above.count - client.count + 1 <= 5 ? "just " : ""}{above.count - client.count + 1} more.
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ height: 1, background: "#E2E8F0" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={text.label}>Question by question</span>
        <p style={text.take}>{heatTakeaway(r)}</p>
        {rows.length === 0 || tools.length === 0 ? (
          <EmptyState>No buyer questions were asked in this scan, so there is no question-by-question grid.</EmptyState>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: `170px repeat(${tools.length}, minmax(0, 1fr))`, gap: 4 }}>
              <span style={{ ...text.small, padding: "4px 0", fontWeight: 700, color: "#0F172A" }}>Buyer question</span>
              {tools.map((t) => (
                <span key={t.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 2px", fontSize: 12, fontWeight: 800 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 6, background: t.color, color: "#FFFFFF", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{t.short}</span>
                  {t.name}
                </span>
              ))}
              {rows.map((q) => [
                <div key={`${q.id}-q`} style={{ padding: "6px 8px 6px 0", fontSize: 12.5, lineHeight: 1.3, fontWeight: 500, display: "flex", alignItems: "center" }}>
                  <span style={clamp(3)}>{q.text}</span>
                </div>,
                ...tools.map((t) => {
                  const c = cellView(q.cells.find((x) => x.tool === t.id), r.scan.runsPerQuestion);
                  return (
                    <div key={`${q.id}-${t.id}`} style={{ background: c.bg, borderRadius: 8, padding: "7px 8px", display: "flex", flexDirection: "column", gap: 2, minHeight: 54, boxSizing: "border-box", justifyContent: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: c.fg, lineHeight: 1.2, overflowWrap: "anywhere", ...clamp(2) }}>{c.first}</span>
                      {c.you && <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.25, color: c.youColor }}>{c.you}</span>}
                    </div>
                  );
                }),
              ])}
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: "#475569", flexWrap: "wrap", alignItems: "center" }}>
              <span>Each box: who AI named first, and where you placed.</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#16A34A" }} />You were first</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#FDE68A" }} />You made the list</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#FEE2E2" }} />You were left out</span>
              {hidden > 0 && <span style={{ fontWeight: 700 }}>Showing {rows.length} of {r.questions.length} questions.</span>}
            </div>
          </>
        )}
      </div>
    </ReportPage>
  );
}
