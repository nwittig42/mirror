import { ReportPage, nn, text, type PageProps } from "@/report/components";
import { headlines } from "@/report/scoring";
import { toolMeta } from "@/report/tokens";
import type { AuditReport, BuyerQuestion, ClosestWin, GridCell } from "@/report/types";
import { SeeAll } from "@/report/see-all";

/* Height budget for the content column of a sheet (1056 minus padding, header, footer). */
const SHEET = 880;
const ROW_H = 62;      // one heatmap row (54px min + 4px gap, with room for wrapping)
const HEAD_H = 30;     // heatmap tool header row
const LEGEND_H = 32;   // gap + legend line
const WIN_H = 46;      // one closest-win row + gap
const WINS_HEAD_H = 72; // rule, label and takeaway (with the gaps between)
const FIRST_SHEET_WINS = 5;

function takeLine(r: AuditReport): string {
  const counts = new Map<string, number>();
  let spots = 0;
  const mine: { cell: GridCell; q: BuyerQuestion }[] = [];
  for (const q of r.questions) {
    for (const c of q.cells) {
      spots += 1;
      if (c.clientRank === 1) { mine.push({ cell: c, q }); continue; }
      counts.set(c.firstNamed, (counts.get(c.firstNamed) ?? 0) + 1);
    }
  }
  if (!spots) return "No buyer questions were checked in this scan.";
  const [topName, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  const lead = topCount > mine.length
    ? `${topName} was named first in ${topCount} of ${spots} spots.`
    : `You were named first in ${mine.length} of ${spots} spots, more than anyone else.`;
  if (topCount <= mine.length) return lead;
  if (mine.length === 0) return `${lead} You were never named first.`;
  if (mine.length === 1) {
    const { cell, q } = mine[0];
    return `${lead} You were first once: ${toolMeta[cell.tool].name}, for “${q.text}”${/[?!.]$/.test(q.text) ? "" : "."}`;
  }
  return `${lead} You were first in ${mine.length}.`;
}

function Heatmap({ r, rows }: { r: AuditReport; rows: BuyerQuestion[] }) {
  const tools = r.scan.tools;
  const runs = r.scan.runsPerQuestion;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `170px repeat(${tools.length}, minmax(0, 1fr))`, gap: 4 }}>
      <span style={{ ...text.small, padding: "4px 0", fontWeight: 700, color: "#0F172A" }}>Buyer question</span>
      {tools.map((t) => (
        <span key={t} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 2px", fontSize: 12, fontWeight: 800 }}>
          <span style={{ width: 18, height: 18, borderRadius: 6, background: toolMeta[t].color, color: "#FFFFFF", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{toolMeta[t].short}</span>
          {toolMeta[t].name}
        </span>
      ))}
      {rows.map((q) => [
        <div key={`${q.id}-q`} style={{ padding: "6px 8px 6px 0", fontSize: 12.5, lineHeight: 1.3, fontWeight: 500, display: "flex", alignItems: "center" }}>
          <span style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{q.text}</span>
        </div>,
        ...tools.map((tool) => {
          const c = q.cells.find((x) => x.tool === tool);
          const v = !c
            ? { first: "Not asked", you: "", bg: "#F1F5F9", fg: "#64748B", youColor: "#64748B" }
            : c.clientRank === 1
              ? { first: "You ★", you: `First · ${c.runsAppeared} of ${runs} runs`, bg: "#16A34A", fg: "#FFFFFF", youColor: "#FFFFFF" }
              : c.clientRank
                ? { first: c.firstNamed, you: `You #${c.clientRank} · ${c.runsAppeared}/${runs}`, bg: "#FDE68A", fg: "#0F172A", youColor: "#92400E" }
                : { first: c.firstNamed, you: "You: left out", bg: "#FEE2E2", fg: "#0F172A", youColor: "#B91C1C" };
          return (
            <div key={`${q.id}-${tool}`} style={{ background: v.bg, borderRadius: 8, padding: "7px 8px", display: "flex", flexDirection: "column", gap: 2, minHeight: 54, boxSizing: "border-box", justifyContent: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: v.fg, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{v.first || "No one"}</span>
              {v.you && <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.25, color: v.youColor }}>{v.you}</span>}
            </div>
          );
        }),
      ])}
    </div>
  );
}

function Legend() {
  return (
    <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: "#475569", flexWrap: "wrap", alignItems: "center" }}>
      <span>Each box: who AI named first, and where you placed.</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#16A34A" }} />You were first</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#FDE68A" }} />You made the list</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#FEE2E2" }} />You were left out</span>
    </div>
  );
}

function WinRows({ r, wins }: { r: AuditReport; wins: ClosestWin[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {wins.map((w, i) => {
        const q = r.questions.find((x) => x.id === w.questionId);
        const m = toolMeta[w.tool];
        return (
          <div key={`${w.questionId}-${w.tool}-${i}`} style={{ display: "grid", gridTemplateColumns: "1fr 104px 230px", gap: 12, alignItems: "center", padding: "5px 12px", borderRadius: 12, background: "#F8FAFC" }}>
            <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>“{q?.text ?? w.questionId}”</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 }}>
              <span style={{ width: 18, height: 18, borderRadius: 6, background: m.color, color: "#FFFFFF", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{m.short}</span>
              {m.name}
            </span>
            <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", height: 30 }} aria-label={`You placed #${w.rank}`}>
              <div style={{ position: "absolute", left: 14, right: 14, top: 14, height: 2, background: "#E2E8F0" }} />
              {[1, 2, 3, 4, 5].map((s) => {
                const v = s === w.rank
                  ? { text: "You", bg: "#2563EB", fg: "#FFFFFF", border: "0" }
                  : s === 1
                    ? { text: "#1", bg: "#16A34A", fg: "#FFFFFF", border: "0" }
                    : s < w.rank
                      ? { text: `#${s}`, bg: "#94A3B8", fg: "#FFFFFF", border: "0" }
                      : { text: "", bg: "#FFFFFF", fg: "#94A3B8", border: "2px solid #E2E8F0" };
                return (
                  <span key={s} style={{ position: "relative", width: 26, height: 26, borderRadius: 13, boxSizing: "border-box", border: v.border, background: v.bg, color: v.fg, fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{v.text}</span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface Sheet { rows: BuyerQuestion[]; wins: ClosestWin[] }

/** Packs the rows and wins that didn't fit on the first sheet into continuation sheets. */
function packContinuation(rows: BuyerQuestion[], wins: ClosestWin[]): Sheet[] {
  const sheets: Sheet[] = [];
  let cur: Sheet = { rows: [], wins: [] };
  let h = 0;
  const flush = () => { if (cur.rows.length || cur.wins.length) sheets.push(cur); cur = { rows: [], wins: [] }; h = 0; };
  for (const q of rows) {
    const need = cur.rows.length ? ROW_H : HEAD_H + ROW_H + LEGEND_H;
    if (h + need > SHEET) flush();
    h += cur.rows.length ? ROW_H : HEAD_H + ROW_H + LEGEND_H;
    cur.rows.push(q);
  }
  for (const w of wins) {
    const need = cur.wins.length ? WIN_H : WINS_HEAD_H + WIN_H;
    if (h + need > SHEET) flush();
    h += cur.wins.length ? WIN_H : WINS_HEAD_H + WIN_H;
    cur.wins.push(w);
  }
  flush();
  return sheets;
}

export function VQuestionsPage({ r, ctx }: PageProps) {
  const section = `${nn(ctx.index)} · Question by question`;
  const wins = [...r.closestWins].sort((a, b) => a.rank - b.rank || b.runsAppeared - a.runsAppeared);
  const firstWins = wins.slice(0, FIRST_SHEET_WINS);
  const winsH = firstWins.length ? firstWins.length * WIN_H : 76;
  // Pill + title (75), takeaway (up to 2 lines, 44), gaps, heatmap header, legend, wins header.
  const fixed = 75 + 16 + 44 + 16 + HEAD_H + LEGEND_H + WINS_HEAD_H;
  const fitRows = Math.max(1, Math.floor((SHEET - fixed - winsH) / ROW_H));
  const firstRows = r.questions.slice(0, fitRows);
  const restRows = r.questions.slice(fitRows);
  const restWins = wins.slice(FIRST_SHEET_WINS);
  const sheets = packContinuation(restRows, restWins);
  const hidden = restRows.length + restWins.length;
  const noun = restRows.length && restWins.length ? "questions and wins" : restRows.length ? "questions" : "closest wins";

  return (
    <>
      <ReportPage r={r} ctx={ctx} section={section} gap={16}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 11px", borderRadius: 99, background: "#EDE9FE", color: "#6D28D9" }}>Who’s beating you</span>
          <h1 style={text.h1}>Question by question</h1>
        </div>
        <p style={text.take}>{takeLine(r)}</p>

        {firstRows.length > 0 ? <Heatmap r={r} rows={firstRows} /> : (
          <div style={{ border: "2px dashed #CBD5E1", borderRadius: 16, padding: "18px 20px", ...text.small }}>No buyer questions were checked in this scan.</div>
        )}
        <Legend />

        <div style={{ height: 1, background: "#E2E8F0" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={text.label}>Closest wins</span>
          <p style={text.take}>{wins.length ? headlines(r).closestWins : "No 2nd or 3rd place finishes yet."}</p>
        </div>
        {firstWins.length > 0 ? <WinRows r={r} wins={firstWins} /> : (
          <div style={{ border: "2px dashed #CBD5E1", borderRadius: 16, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>No near misses this time</span>
            <span style={text.small}>You didn’t place 2nd or 3rd on any question.</span>
          </div>
        )}
      </ReportPage>
      <SeeAll hiddenCount={hidden} noun={noun}>
        {sheets.map((s, i) => (
          <ReportPage key={i} r={r} ctx={ctx} section={section} gap={16} continued>
            {s.rows.length > 0 && (
              <>
                <Heatmap r={r} rows={s.rows} />
                <Legend />
              </>
            )}
            {s.wins.length > 0 && (
              <>
                {s.rows.length > 0 && <div style={{ height: 1, background: "#E2E8F0" }} />}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={text.label}>Closest wins</span>
                </div>
                <WinRows r={r} wins={s.wins} />
              </>
            )}
          </ReportPage>
        ))}
      </SeeAll>
    </>
  );
}
