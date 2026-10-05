import type { FactCheck } from "@/report/types";
import { ReportPage, EmptyState, ToolBadge, FONT_DISPLAY, text, nn, type PageProps } from "@/report/components";
import { factScoreView, headlines, mistakesByTool, ringDash, sortedWrongFacts } from "@/report/scoring";
import { color, statusColor } from "@/report/tokens";
import { SeeAll } from "@/report/see-all";

/**
 * Rough line count for wrapped text, used to decide how many list rows fit on
 * a fixed sheet. Deliberately a little pessimistic so nothing overflows.
 */
export function estLines(s: string, fontSize: number, width: number, bold = false): number {
  const perChar = fontSize * (bold ? 0.56 : 0.48);
  const perLine = Math.max(1, Math.floor(width / perChar));
  const words = s.split(/\s+/).filter(Boolean);
  let lines = 1;
  let at = 0;
  for (const w of words) {
    const len = w.length;
    if (at === 0) at = len;
    else if (at + 1 + len <= perLine) at += 1 + len;
    else { lines += 1; at = len; }
    while (at > perLine) { lines += 1; at -= perLine; }
  }
  return lines;
}

/** Splits items into sheets by estimated height: first sheet gets `first` px, the rest `next` px each. */
export function paginate<T>(items: T[], height: (item: T, i: number) => number, first: number, next: number, gap: number, minFirst = 1): T[][] {
  const pages: T[][] = [];
  let cur: T[] = [];
  let used = 0;
  let budget = first;
  items.forEach((it, i) => {
    const h = height(it, i);
    const need = cur.length ? used + gap + h : h;
    const forced = pages.length === 0 && cur.length < minFirst;
    if (need > budget && !forced && (cur.length || pages.length === 0)) {
      pages.push(cur);
      cur = [it];
      used = h;
      budget = next;
    } else {
      cur.push(it);
      used = need;
    }
  });
  if (cur.length || !pages.length) pages.push(cur);
  return pages;
}

const endPunct = (s: string) => (/[.!?…”"]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

function factDetail(f: FactCheck): string {
  if (f.isTrue) return f.truth;
  return `AI said: ${endPunct(f.aiSaid ?? "something different")} Truth: ${endPunct(f.truth)}`;
}

/** Height of one row of the 2-column fact grid (the taller of the pair). */
function rowHeight(pair: FactCheck[]): number {
  const TEXT_W = 200;
  return Math.max(...pair.map((f) => {
    const h = estLines(f.topic, 13.5, TEXT_W, true) * 17.6 + 1 + estLines(factDetail(f), 12, TEXT_W) * 16.2;
    return 20 + Math.max(26, h);
  }));
}

function FactRow({ f }: { f: FactCheck }) {
  const s = f.isTrue ? statusColor.good : statusColor.bad;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 66px", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 12, background: s.soft }}>
      <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: 13, background: s.fill, color: "#FFFFFF", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{f.isTrue ? "✓" : "✕"}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, overflowWrap: "anywhere" }}>{f.topic}</span>
        <span style={{ fontSize: 12, lineHeight: 1.35, color: color.text2, overflowWrap: "anywhere" }}>{factDetail(f)}</span>
      </div>
      <span style={{ justifySelf: "end", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.06em", padding: "3px 8px", borderRadius: 99, background: s.fill, color: "#FFFFFF" }}>{f.isTrue ? "TRUE" : "FALSE"}</span>
    </div>
  );
}

function FactGrid({ rows }: { rows: FactCheck[][] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
      {rows.flat().map((f) => <FactRow key={f.id} f={f} />)}
    </div>
  );
}

export function FTrueFalsePage({ r, ctx }: PageProps) {
  const section = `${nn(ctx.index)} · True or false`;
  const wrong = sortedWrongFacts(r.facts);
  const facts = [...wrong, ...r.facts.filter((f) => f.isTrue)];
  const right = facts.length - wrong.length;

  const fs = factScoreView(r.scores.factAccuracy);
  const bc = fs.colors;
  const R = 62;

  const priceFact = wrong.find((f) => f.isPrice);
  const verdict = !facts.length
    ? `We didn’t check any facts about ${r.business.name} in this scan.`
    : wrong.length
      ? `${headlines(r).factVerdict}${priceFact ? ` The ${wrong.length} it gets wrong include${wrong.length === 1 ? "s" : ""} your ${priceFact.topic}.` : ""}`
      : headlines(r).factVerdict;

  const tools = mistakesByTool(r.facts, r.scan.tools)
    .map((t, i) => ({ ...t, i }))
    .sort((a, b) => b.wrong - a.wrong || a.i - b.i);

  // Strip: one cell per fact. Past ~30 cells the icons get too small, so the cells go plain (the list below still labels each one).
  const stripIcons = facts.length <= 30;

  // Pair facts into grid rows, then split rows across sheets by estimated height.
  const pairs: FactCheck[][] = [];
  for (let i = 0; i < facts.length; i += 2) pairs.push(facts.slice(i, i + 2));
  const sheets = paginate(pairs, rowHeight, 450, 800, 8, 1);
  const [firstRows, ...moreSheets] = sheets;
  const hiddenCount = moreSheets.flat(2).length;

  return (
    <>
      <ReportPage r={r} ctx={ctx} section={section} gap={20}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 24, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 11px", borderRadius: 99, background: "#DCFCE7", color: "#15803D" }}>True or false</span>
            <h1 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: 29, lineHeight: 1.25, letterSpacing: "-0.01em", textWrap: "balance" }}>{verdict}</h1>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ position: "relative", width: 150, height: 150 }}>
              <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
                <circle cx="75" cy="75" r={R} fill="none" stroke={color.track} strokeWidth="18" />
                <circle cx="75" cy="75" r={R} fill="none" strokeWidth="18" transform="rotate(-90 75 75)" style={{ stroke: bc.fill, strokeDasharray: ringDash(fs.ring, R) }} />
              </svg>
              <div style={{ position: "absolute", left: 0, top: 0, width: 150, height: 150, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{fs.shown}</span>
                <span style={{ fontSize: 11, color: color.subtle }}>accuracy</span>
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99, background: bc.fill, color: "#FFFFFF" }}>{fs.label}</span>
          </div>
        </div>

        {facts.length > 0 && (
          <div role="img" aria-label={`${right} true, ${wrong.length} false`} style={{ display: "flex", gap: facts.length > 20 ? 2 : 3, height: 26 }}>
            {facts.map((f) => (
              <div key={f.id} style={{ flexGrow: 1, flexBasis: 0, background: f.isTrue ? statusColor.good.fill : statusColor.bad.fill, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF", fontSize: 12, fontWeight: 800 }}>
                {stripIcons ? (f.isTrue ? "✓" : "✕") : null}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={text.label}>Every fact we checked</span>
          {facts.length ? (
            <FactGrid rows={firstRows} />
          ) : (
            <EmptyState>No facts were checked in this scan.</EmptyState>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={text.label}>Mistakes by AI tool</span>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, tools.length)}, minmax(0, 1fr))`, gap: 8 }}>
            {tools.map((t) => {
              const s = t.wrong ? statusColor.bad : statusColor.good;
              return (
                <div key={t.tool} style={{ borderRadius: 14, padding: 12, background: s.soft, display: "flex", flexDirection: "column", gap: 6, alignItems: "center", textAlign: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 800 }}>
                    <ToolBadge tool={t.tool} size={20} radius={6} />{t.name}
                  </span>
                  <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: s.text }}>{t.wrong}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: s.text }}>{t.wrong ? `${t.wrong} wrong fact${t.wrong > 1 ? "s" : ""}` : "No mistakes"}</span>
                </div>
              );
            })}
          </div>
        </div>
      </ReportPage>

      <SeeAll hiddenCount={hiddenCount} noun="facts">
        {moreSheets.map((rows, i) => (
          <ReportPage key={i} r={r} ctx={ctx} section={section} gap={20} continued>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={text.label}>Every fact we checked (continued)</span>
              <FactGrid rows={rows} />
            </div>
          </ReportPage>
        ))}
      </SeeAll>
    </>
  );
}
