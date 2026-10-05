import type { CSSProperties } from "react";
import type { AuditReport, ClosestWin, Quote } from "@/report/types";
import {
  Donut, FONT_DISPLAY, ReportPage, StagePill, Takeaway, ToolBadge, nn, text, type PageCtx, type PageProps,
} from "@/report/components";
import { SeeAll } from "@/report/see-all";
import { conicDonut, toneTotal, variantPages } from "@/report/scoring";
import { color, statusColor, toneColor, toolMeta } from "@/report/tokens";

/** Page 05: closest wins with position tracks, then tone donut and quotes (P05-Wins-Tone). */

/** The design shows up to 5 wins; fewer when long text would push the sheet past its height. */
const WINS_MAX_ON_SHEET = 5;
/** Usable content height of a sheet (911px column minus its 26px top padding), with a safety margin. */
const SHEET_BUDGET = 885 - 10;

/** Rough line count for text of `chars` characters at `perLine` characters per line. */
const lines = (chars: number, perLine: number) => Math.max(1, Math.ceil(chars / perLine));

function winRowHeight(r: AuditReport, w: ClosestWin) {
  const q = r.questions.find((x) => x.id === w.questionId)?.text ?? w.questionId;
  const sub = (w.ahead.length ? `Behind ${w.ahead.join(", ")} · ` : "").length + 20;
  return 21 + 17.5 * lines(q.length + 2, 40) + 2 + 17.4 * lines(sub, 48);
}

function quoteHeight(r: AuditReport, q: Quote) {
  const question = q.questionId ? r.questions.find((x) => x.id === q.questionId)?.text ?? "" : "";
  const src = toolMeta[q.tool].name.length + question.length + 5;
  return 56 + 23.1 * lines(q.text.length + 2, 44) + 17.4 * lines(src, 55);
}

/** Split `heights` into sheets: the first holds up to `firstMax` within `firstBudget`, the rest fill `budget`. */
function pack(heights: number[], firstBudget: number, firstMax: number, budget: number) {
  const out: number[][] = [];
  let cur: number[] = [];
  let used = 0;
  heights.forEach((h, i) => {
    const cap = out.length === 0 ? firstBudget : budget;
    const full = out.length === 0 && cur.length >= firstMax;
    if (cur.length && (used + h > cap || full)) { out.push(cur); cur = []; used = 0; }
    cur.push(i); used += h;
  });
  if (cur.length || !out.length) out.push(cur);
  return out;
}
const SLOT_LABELS = ["#1", "#2", "#3", "#4", "#5"];
const GRID = "1fr 110px 250px";

const h2: CSSProperties = { fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: 28, lineHeight: 1.2, margin: 0 };

/** "4–6 of 9", or "4 of 4" for a single item. */
const span = (start: number, count: number, total: number) =>
  count > 1 ? `${start + 1}–${start + count} of ${total}` : `${start + 1} of ${total}`;

function section(ctx: PageCtx) {
  return `${nn(ctx.index)} · Closest wins · How AI describes you`;
}

function winsTake(n: number) {
  return n
    ? `You placed 2nd or 3rd in ${n} answer${n > 1 ? "s" : ""}. Each is one or two spots from first.`
    : "You didn’t place 2nd or 3rd anywhere, so there are no quick flips yet.";
}

function toneTake(r: AuditReport) {
  const t = r.tone;
  const total = toneTotal(t);
  if (!total) return "AI didn’t name you in any answer, so there’s no tone to report yet.";
  const kinds: [number, string][] = [
    [t.recommended, "positive"], [t.justListed, "neutral"], [t.mixed, "mixed"], [t.warnedAgainst, "negative"],
  ];
  const max = Math.max(...kinds.map(([n]) => n));
  const top = kinds.filter(([n]) => n === max);
  const lead = top.length === 1 ? `When AI names you, it’s mostly ${top[0][1]}: ` : "When AI names you, ";
  const warned = t.warnedAgainst === 0
    ? "none warn against you"
    : `${t.warnedAgainst} warn${t.warnedAgainst === 1 ? "s" : ""} against you`;
  return `${lead}${t.recommended} of ${total} answers recommend you, ${warned}.`;
}

function slotStyle(i: number, rank: number) {
  if (i === rank) return { text: "You", bg: color.client, fg: "#FFFFFF", border: "0" };
  if (i === 1) return { text: "#1", bg: statusColor.good.fill, fg: "#FFFFFF", border: "0" };
  if (i < rank) return { text: `#${i}`, bg: color.competitorDark, fg: "#FFFFFF", border: "0" };
  return { text: "", bg: "#FFFFFF", fg: color.competitorDark, border: `2px solid ${color.rule}` };
}

function WinsHeader() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 14, padding: "6px 0", borderBottom: `1px solid ${color.rule}` }}>
      <span style={{ ...text.small, fontWeight: 700, color: color.ink }}>Question</span>
      <span style={{ ...text.small, fontWeight: 700, color: color.ink }}>AI tool</span>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 6px" }}>
        {SLOT_LABELS.map((l) => (
          <span key={l} style={{ ...text.small, width: 28, textAlign: "center", fontWeight: 700, color: color.ink }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function WinRow({ r, w }: { r: AuditReport; w: ClosestWin }) {
  const q = r.questions.find((x) => x.id === w.questionId)?.text ?? w.questionId;
  const meta = toolMeta[w.tool];
  return (
    <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 14, padding: "10px 0", borderBottom: `1px solid ${color.track}`, alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3, overflowWrap: "anywhere" }}>“{q}”</span>
        <span style={text.small}>
          {w.ahead.length ? `Behind ${w.ahead.join(", ")} · ` : ""}seen in {w.runsAppeared} of {r.scan.runsPerQuestion} runs
        </span>
      </div>
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700 }}>
        <ToolBadge tool={w.tool} size={20} radius={6} />{meta.name}
      </span>
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 6px", height: 34 }}>
        <div style={{ position: "absolute", left: 20, right: 20, top: 16, height: 2, background: color.rule }} />
        {[1, 2, 3, 4, 5].map((i) => {
          const s = slotStyle(i, w.rank);
          return (
            <span key={i} style={{ position: "relative", width: 28, height: 28, borderRadius: 14, boxSizing: "border-box", border: s.border, background: s.bg, color: s.fg, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {s.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Legend() {
  const dot = (bg: string) => <span style={{ width: 12, height: 12, borderRadius: 6, background: bg }} />;
  return (
    <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: color.muted, paddingTop: 8 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{dot(color.client)}You</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{dot(color.competitorDark)}A competitor ahead of you</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{dot(statusColor.good.fill)}Spot #1, one place to climb</span>
    </div>
  );
}

function QuoteCard({ r, q, kind }: { r: AuditReport; q: Quote; kind: "best" | "worst" }) {
  const s = kind === "best" ? statusColor.good : statusColor.warn;
  const question = q.questionId ? r.questions.find((x) => x.id === q.questionId)?.text : undefined;
  return (
    <div style={{ background: s.soft, borderRadius: 16, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: s.text }}>
        <span style={{ width: 18, height: 18, borderRadius: 9, background: s.text, color: "#FFFFFF", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {kind === "best" ? "+" : "!"}
        </span>
        {kind === "best" ? "Best thing AI said" : "Worst thing AI said"}
      </span>
      <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontStyle: "italic", fontSize: 16.5, lineHeight: 1.4, color: color.ink }}>“{q.text}”</p>
      <span style={text.small}>{toolMeta[q.tool].name}{question ? ` · “${question}”` : ""}</span>
    </div>
  );
}

export function WinsTonePage({ r, ctx }: PageProps) {
  const wins = r.closestWins;
  const planPage = variantPages[ctx.variant].indexOf("action_plan") + 1;

  const t = r.tone;
  const total = toneTotal(t);
  const tone = [
    { name: "Recommended", count: t.recommended, color: toneColor.recommended, def: "AI suggests you by name." },
    { name: "Just listed", count: t.justListed, color: toneColor.justListed, def: "Named, no opinion." },
    { name: "Mixed", count: t.mixed, color: toneColor.mixed, def: "Praise with a “but”." },
    { name: "Warned against", count: t.warnedAgainst, color: toneColor.warnedAgainst, def: "Tells people to avoid you." },
  ];
  const donut = total ? conicDonut(tone.map((x) => ({ value: x.count, color: x.color })), 0.8) : color.track;
  const quotes = [
    r.quotes.best ? { q: r.quotes.best, kind: "best" as const } : null,
    r.quotes.worst ? { q: r.quotes.worst, kind: "worst" as const } : null,
  ].filter((x) => x !== null);

  // Fit the wins table between the fixed blocks on the sheet (heights measured from the design).
  const take = (s: string) => 22.4 * lines(s.length, 80);
  const toneBlock = Math.max(160, quotes.length ? quotes.reduce((a, x) => a + quoteHeight(r, x.q), 0) + 10 * (quotes.length - 1) : 70);
  const fixed = 76 + take(winsTake(wins.length)) + 5 + 68 + take(toneTake(r)) + toneBlock + 6 * 16 + 30 + 26;
  const sheets = pack(wins.map((w) => winRowHeight(r, w)), SHEET_BUDGET - fixed, WINS_MAX_ON_SHEET, SHEET_BUDGET - 17 - 16 - 56);
  const shown = (sheets[0] ?? []).map((i) => wins[i]);
  const rest = wins.slice(shown.length);
  const chunks = sheets.slice(1).map((idx) => idx.map((i) => wins[i]));
  const starts = chunks.map((_, ci) => shown.length + chunks.slice(0, ci).reduce((a, c) => a + c.length, 0));

  return (
    <>
      <ReportPage r={r} ctx={ctx} section={section(ctx)} gap={16}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <StagePill stage="losing">Easiest to flip</StagePill>
          <h1 style={text.h1}>Closest wins</h1>
        </div>
        <Takeaway>{winsTake(wins.length)}</Takeaway>

        {shown.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", borderTop: `1px solid ${color.rule}` }}>
            <WinsHeader />
            {shown.map((w, i) => <WinRow key={`${w.questionId}-${w.tool}-${i}`} r={r} w={w} />)}
            <Legend />
          </div>
        ) : (
          <div style={{ border: `2px dashed ${color.competitor}`, borderRadius: 16, padding: "22px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>No near misses this time</span>
            <span style={text.small}>
              You didn’t place 2nd or 3rd on any question.
              {planPage > 0 ? ` Page ${planPage} focuses on getting you onto the list first.` : ""}
            </span>
          </div>
        )}

        <div style={{ height: 1, background: color.rule, marginTop: 4 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <StagePill stage="wrong">How AI talks about you</StagePill>
          <h2 style={h2}>How AI describes you</h2>
        </div>
        <Takeaway>{toneTake(r)}</Takeaway>

        <div style={{ display: "grid", gridTemplateColumns: "290px 1fr", gap: 24, alignItems: "start" }}>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <Donut background={donut} size={130} hole={78}>
              <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{total}</span>
              <span style={{ fontSize: 10, color: color.subtle }}>mention{total === 1 ? "" : "s"}</span>
            </Donut>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tone.map((x) => (
                <div key={x.name} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: x.color }} />
                    {x.name} <span style={{ fontWeight: 800 }}>{x.count}</span>
                  </span>
                  <span style={{ ...text.small, paddingLeft: 19 }}>{x.def}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {quotes.length ? (
              quotes.map((x) => <QuoteCard key={x.kind} r={r} q={x.q} kind={x.kind} />)
            ) : (
              <div style={{ border: `2px dashed ${color.competitor}`, borderRadius: 16, padding: "22px 20px", ...text.small }}>
                No quotes to show. AI didn’t say anything about you worth quoting in this scan.
              </div>
            )}
          </div>
        </div>
      </ReportPage>

      <SeeAll hiddenCount={rest.length} noun="closest wins">
        {chunks.map((chunk, ci) => (
          <ReportPage key={ci} r={r} ctx={ctx} section={section(ctx)} gap={16} continued>
            <span style={text.label}>
              Closest wins, {span(starts[ci], chunk.length, wins.length)}
            </span>
            <div style={{ display: "flex", flexDirection: "column", borderTop: `1px solid ${color.rule}` }}>
              <WinsHeader />
              {chunk.map((w, i) => <WinRow key={`${w.questionId}-${w.tool}-${i}`} r={r} w={w} />)}
              <Legend />
            </div>
          </ReportPage>
        ))}
      </SeeAll>
    </>
  );
}
