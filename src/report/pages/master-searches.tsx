import type { AuditReport, PageStatus, PageWanted, SearchQuery } from "@/report/types";
import {
  NoteBox, ReportPage, StagePill, Takeaway, ToolBadge, nn, text, type PageCtx, type PageProps,
} from "@/report/components";
import { SeeAll } from "@/report/see-all";
import { headlines, variantPages } from "@/report/scoring";
import { color, statusColor, toolMeta } from "@/report/tokens";

/** Page 07: searches AI ran, the words it added, the pages it looks for (P07-Searches). */

/** The design shows up to 3 searches and 4 pages; fewer when long text would overflow the sheet. */
const SEARCHES_MAX_ON_SHEET = 3;
const PAGES_MAX_ON_SHEET = 4;
/** Usable content height of a sheet (911px column minus its 26px top padding), with a safety margin. */
const SHEET_BUDGET = 885 - 10;
/** Continuation sheets: label (17) + gap (18). */
const CONT_BUDGET = SHEET_BUDGET - 35;

/** Rough line count for text of `chars` characters at `perLine` characters per line. */
const lines = (chars: number, perLine: number) => Math.max(1, Math.ceil(chars / perLine));

/** Search bar height plus the 8px gap under it. */
function searchHeight(s: SearchQuery) {
  // ~614px for the query minus the tool chips (84px each with a name, 28px badge-only), ~8px per character.
  const chips = s.tools.length * (s.tools.length > 3 ? 28 : 84);
  return 22 + 22.5 * lines(s.query.length, Math.max(18, Math.floor((614 - chips) / 8))) + 8;
}

/** "Pages AI is looking for" row height plus the 10px gap under it. */
function pageHeight(p: PageWanted) {
  return 37 + 19.6 * lines(p.page.length, 26) + 17.4 * lines(p.why.length, 34) + 10;
}

/** How many leading items fit in `budget` (at least one, at most `max`). */
function fitCount(heights: number[], budget: number, max: number) {
  let used = 0;
  let n = 0;
  for (const h of heights) {
    if (n >= max || (n > 0 && used + h > budget)) break;
    used += h; n += 1;
  }
  return n;
}

/** Split items into continuation sheets by height. */
function pack<T>(items: T[], height: (x: T) => number, budget: number) {
  const out: T[][] = [];
  let cur: T[] = [];
  let used = 0;
  for (const x of items) {
    const h = height(x);
    if (cur.length && used + h > budget) { out.push(cur); cur = []; used = 0; }
    cur.push(x); used += h;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Bubble layout: fixed spots, biggest first. */
const SPOTS = [
  { x: 22, y: 22, size: 124, font: 17 }, { x: 160, y: 30, size: 104, font: 15 },
  { x: 60, y: 150, size: 88, font: 14 }, { x: 166, y: 138, size: 84, font: 11 },
];
const BUBBLE_COLORS = ["#7C3AED", "#0D9488", "#E8590C", "#DB2777"];

const STATUS: Record<PageStatus, { status: string; icon: string; bg: string; soft: string; wordColor: string }> = {
  missing: { status: "Missing", icon: "✕", bg: statusColor.bad.fill, soft: statusColor.bad.soft, wordColor: statusColor.bad.text },
  partial: { status: "Partly there", icon: "!", bg: statusColor.warn.strong, soft: statusColor.warn.soft, wordColor: statusColor.warn.text },
  have: { status: "Have it", icon: "✓", bg: statusColor.good.fill, soft: statusColor.good.soft, wordColor: statusColor.good.text },
};

type Continuation =
  | { kind: "searches"; items: SearchQuery[]; start: number }
  | { kind: "pages"; items: PageWanted[]; start: number };

/** "4–6 of 9", or "4 of 4" for a single item. */
const span = (start: number, count: number, total: number) =>
  count > 1 ? `${start + 1}–${start + count} of ${total}` : `${start + 1} of ${total}`;

function section(ctx: PageCtx) {
  return `${nn(ctx.index)} · What AI searched for`;
}

function joinWords(words: string[]) {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

function searchTake(r: AuditReport) {
  const q = r.searches.queries;
  if (!q.length) return headlines(r).searches ?? "No web searches were recorded in this scan.";
  const words = r.searches.addedWords.slice(0, 3);
  if (words.length) return `AI searched for ${joinWords(words)} before naming anyone.`;
  return `AI ran ${q.length} web search${q.length > 1 ? "es" : ""} before naming anyone.`;
}

function SearchBar({ s }: { s: SearchQuery }) {
  const compact = s.tools.length > 3;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, border: `2px solid ${color.rule}`, borderRadius: 999, padding: "8px 10px 8px 18px", background: "#FFFFFF" }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color.client} strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
        <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
      </svg>
      <span style={{ flexGrow: 1, minWidth: 0, overflowWrap: "anywhere", fontSize: 15, fontWeight: 600 }}>{s.query}</span>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {s.tools.map((t) => (
          <span key={t} style={{ display: "flex", alignItems: "center", gap: 5, padding: compact ? 3 : "3px 9px 3px 3px", borderRadius: 99, background: color.track, fontSize: 11.5, fontWeight: 700 }}>
            <ToolBadge tool={t} size={18} radius={9} />
            {compact ? null : toolMeta[t].name}
          </span>
        ))}
      </div>
    </div>
  );
}

function PageRow({ p }: { p: PageWanted }) {
  const s = STATUS[p.status];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 12, alignItems: "center", padding: "10px 12px", borderRadius: 12, background: s.soft }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: s.wordColor }}>“{p.word}”</span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{p.page}</span>
        <span style={{ ...text.small, color: color.muted }}>{p.why}</span>
      </div>
      <span style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 800, padding: "4px 10px", borderRadius: 99, background: s.bg, color: "#FFFFFF", whiteSpace: "nowrap" }}>
        {s.icon} {s.status}
      </span>
    </div>
  );
}

export function SearchesPage({ r, ctx }: PageProps) {
  const q = r.searches.queries;
  const has = q.length > 0;
  const pagesAll = r.searches.pagesWanted;
  // Fixed blocks on the sheet: heading 128, takeaway, note 111, four 18px gaps.
  const fixed = 128 + 22.4 * lines(searchTake(r).length, 80) + 111 + 4 * 18;
  const nSearches = fitCount(q.map(searchHeight), SHEET_BUDGET - fixed - 290 - 18, SEARCHES_MAX_ON_SHEET);
  const searches = q.slice(0, nSearches);
  const searchesRest = q.slice(nSearches);
  const searchesBlock = searches.reduce((a, x) => a + searchHeight(x), 0) - 8;
  const nPages = fitCount(pagesAll.map(pageHeight), SHEET_BUDGET - fixed - searchesBlock - 18 - 23 + 10, PAGES_MAX_ON_SHEET);
  const pages = pagesAll.slice(0, nPages);
  const pagesRest = has ? pagesAll.slice(nPages) : [];
  const words = r.searches.addedWords.slice(0, SPOTS.length).map((word, i) => ({ word, rank: i + 1, color: BUBBLE_COLORS[i], ...SPOTS[i] }));
  const sourcesPage = variantPages[ctx.variant].indexOf("sources") + 1;

  const continuation: Continuation[] = [];
  let at = nSearches;
  for (const items of pack(searchesRest, searchHeight, CONT_BUDGET)) {
    continuation.push({ kind: "searches", items, start: at });
    at += items.length;
  }
  at = nPages;
  for (const items of pack(pagesRest, pageHeight, CONT_BUDGET)) {
    continuation.push({ kind: "pages", items, start: at });
    at += items.length;
  }

  return (
    <>
      <ReportPage r={r} ctx={ctx} section={section(ctx)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <StagePill stage="losing">Why they’re winning</StagePill>
          <h1 style={text.h1}>What AI searched for</h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: color.muted, maxWidth: 580 }}>
            Before answering, some assistants search the web like a person would. These are the real searches they ran, and they show which pages AI is looking for.
          </p>
        </div>

        <Takeaway>{searchTake(r)}</Takeaway>
        {has ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {searches.map((s, i) => <SearchBar key={s.query + i} s={s} />)}
          </div>
        ) : (
          <div style={{ border: `2px dashed ${color.competitor}`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>No searches recorded</span>
            <span style={text.small}>
              The assistants answered from what they already knew, without searching first.
              {sourcesPage > 0 ? ` That makes the sites on page ${nn(sourcesPage)} even more important.` : ""}
            </span>
          </div>
        )}

        {has && (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={text.label}>Words AI kept adding</span>
              {words.length ? (
                <>
                  <div style={{ position: "relative", height: 250, background: color.panel, borderRadius: 18 }}>
                    {words.map((w) => (
                      <span key={w.rank} style={{ position: "absolute", left: w.x, top: w.y, width: w.size, height: w.size, boxSizing: "border-box", padding: 6, borderRadius: "50%", background: w.color, color: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", fontWeight: 800, fontSize: w.font, lineHeight: 1.1, overflowWrap: "anywhere" }}>
                        {w.word}
                        <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.85 }}>#{w.rank}</span>
                      </span>
                    ))}
                  </div>
                  <span style={text.small}>Bigger bubble = added more often.</span>
                </>
              ) : (
                <div style={{ border: `2px dashed ${color.competitor}`, borderRadius: 12, padding: 14, ...text.small }}>
                  AI searched with the question as asked and didn’t add any words of its own.
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={text.label}>The pages AI is looking for</span>
              {pages.length ? pages.map((p, i) => <PageRow key={p.word + i} p={p} />) : (
                <div style={{ border: `2px dashed ${color.competitor}`, borderRadius: 12, padding: 14, ...text.small }}>
                  No missing pages stood out from these searches.
                </div>
              )}
            </div>
          </div>
        )}

        <NoteBox>
          <p style={{ margin: 0 }}>AI shops the way your customers do: it wants current prices, reviews and hours. If your site doesn’t answer those clearly, AI finds the answer somewhere else, sometimes an old or wrong one.</p>
        </NoteBox>
      </ReportPage>

      <SeeAll hiddenCount={searchesRest.length + pagesRest.length} noun="searches and pages">
        {continuation.map((c, ci) => (
          <ReportPage key={ci} r={r} ctx={ctx} section={section(ctx)} continued>
            {c.kind === "searches" ? (
              <>
                <span style={text.label}>Searches {span(c.start, c.items.length, q.length)}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {c.items.map((s, i) => <SearchBar key={s.query + i} s={s} />)}
                </div>
              </>
            ) : (
              <>
                <span style={text.label}>The pages AI is looking for, {span(c.start, c.items.length, pagesAll.length)}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {c.items.map((p, i) => <PageRow key={p.word + i} p={p} />)}
                </div>
              </>
            )}
          </ReportPage>
        ))}
      </SeeAll>
    </>
  );
}
