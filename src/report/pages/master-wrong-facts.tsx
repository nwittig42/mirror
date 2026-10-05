import type { FactCheck, Severity } from "@/report/types";
import {
  CheckIcon, CrossIcon, EmptyState, NoteBox, ReportPage, StagePill, Takeaway, ToolBadge, nn, text,
  type PageCtx, type PageProps,
} from "@/report/components";
import { SeeAll } from "@/report/see-all";
import { factScoreView, headlines, ringDash, severityCounts, sortedWrongFacts } from "@/report/scoring";
import { color, statusColor, toolMeta } from "@/report/tokens";

/** Page 08: accuracy ring, severity counts, "AI said -> the truth" cards (P08-Wrong-Facts). */

/** Up to 3 facts on the sheet (fewer if long text would overflow it), up to 4 per continuation sheet. */
const FACTS_MAX_ON_SHEET = 3;
const FACTS_MAX_PER_CONTINUATION = 4;
/** Usable content height of a sheet (911px column minus its 26px top padding), with a safety margin. */
const SHEET_BUDGET = 885 - 10;

const lines = (chars: number, perLine: number) => Math.max(1, Math.ceil(chars / perLine));

/** Card height plus the 14px gap under it, from the design's measurements. */
function cardHeight(f: FactCheck) {
  const box = 39 + 20.25 * Math.max(lines((f.aiSaid ?? "").length + 2, 33), lines(f.truth.length, 30));
  const chips = (f.sources ?? []).reduce((a, s) => a + s.length * 7.5 + 28, 130);
  return 109 + box + 26 * (lines(chips, 652) - 1) + 14;
}

/** Split facts into sheets by height: the first sheet gets `first` px, the others `rest` px. */
function pack(facts: FactCheck[], first: number, rest: number) {
  const out: FactCheck[][] = [];
  let cur: FactCheck[] = [];
  let used = 0;
  for (const f of facts) {
    const h = cardHeight(f);
    const max = out.length === 0 ? FACTS_MAX_ON_SHEET : FACTS_MAX_PER_CONTINUATION;
    const budget = (out.length === 0 ? first : rest) + 14;
    if (cur.length && (cur.length >= max || used + h > budget)) { out.push(cur); cur = []; used = 0; }
    cur.push(f); used += h;
  }
  out.push(cur);
  return out;
}

const SEV: Record<Severity, { label: string; bg: string; fg: string }> = {
  critical: { label: "Critical", bg: statusColor.bad.fill, fg: "#FFFFFF" },
  major: { label: "Major", bg: statusColor.warn.fill, fg: color.ink },
  minor: { label: "Minor", bg: color.rule, fg: color.text2 },
};

/** "4–6 of 9", or "4 of 4" for a single item. */
const span = (start: number, count: number, total: number) =>
  count > 1 ? `${start + 1}–${start + count} of ${total}` : `${start + 1} of ${total}`;

function section(ctx: PageCtx) {
  return `${nn(ctx.index)} · What AI gets wrong about you`;
}

function FactCard({ f }: { f: FactCheck }) {
  const sev = SEV[f.severity ?? "minor"];
  const sources = f.sources ?? [];
  return (
    <div style={{ border: `1px solid ${color.rule}`, borderRadius: 18, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 1px 2px rgba(15,23,42,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 99, background: sev.bg, color: sev.fg }}>{sev.label}</span>
        {f.isPrice && (
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 99, border: `2px solid ${statusColor.bad.fill}`, color: statusColor.bad.text }}>$ Price</span>
        )}
        <span style={{ fontSize: 14, fontWeight: 800, marginLeft: 4 }}>{f.topic}</span>
        {f.tool && (
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: color.muted }}>
            Said by <ToolBadge tool={f.tool} size={20} radius={6} />{toolMeta[f.tool].name}
          </span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 28px 1fr", gap: 8, alignItems: "center" }}>
        <div style={{ background: statusColor.bad.soft, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 12, background: statusColor.bad.fill, display: "flex", alignItems: "center", justifyContent: "center" }}><CrossIcon size={12} /></span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ ...text.label, color: statusColor.bad.text }}>AI said</span>
            <span style={{ fontSize: 15, lineHeight: 1.35, overflowWrap: "anywhere" }}>“{f.aiSaid ?? ""}”</span>
          </div>
        </div>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color.competitorDark} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h13" /><path d="M13 6l6 6-6 6" />
        </svg>
        <div style={{ background: statusColor.good.soft, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 12, background: statusColor.good.fill, display: "flex", alignItems: "center", justifyContent: "center" }}><CheckIcon size={13} /></span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ ...text.label, color: statusColor.good.text }}>The truth</span>
            <span style={{ fontSize: 15, lineHeight: 1.35, fontWeight: 800, overflowWrap: "anywhere" }}>{f.truth}</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={text.label}>Where AI read it</span>
        {sources.length ? sources.map((s) => (
          <span key={s} style={{ fontSize: 12.5, padding: "3px 10px", borderRadius: 99, background: color.track, fontWeight: 700 }}>{s}</span>
        )) : <span style={text.small}>Not shown. The assistant didn’t list a source.</span>}
      </div>
    </div>
  );
}

export function WrongFactsPage({ r, ctx }: PageProps) {
  const wrong = sortedWrongFacts(r.facts);
  // Sheet: heading block 169, note 111, two 18px gaps. Continuation: label 17 + 18px gap.
  const sheets = pack(wrong, SHEET_BUDGET - 169 - 111 - 36, SHEET_BUDGET - 35);
  const shown = sheets[0];
  const rest = wrong.slice(shown.length);
  const chunks = sheets.slice(1);
  const starts = chunks.map((_, ci) => shown.length + chunks.slice(0, ci).reduce((a, c) => a + c.length, 0));
  const counts = severityCounts(r.facts);
  const fs = factScoreView(r.scores.factAccuracy);
  const ring = fs.colors.fill;
  const rows = [
    { name: "Critical", n: counts.critical, bg: statusColor.bad.fill },
    { name: "Major", n: counts.major, bg: statusColor.warn.strong },
    { name: "Minor", n: counts.minor, bg: color.competitorDark },
  ];

  return (
    <>
      <ReportPage r={r} ctx={ctx} section={section(ctx)}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <StagePill stage="wrong" />
            <h1 style={text.h1}>What AI gets wrong about you</h1>
            <Takeaway>{headlines(r).facts}</Takeaway>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", background: color.panel, borderRadius: 18, padding: 14 }}>
            <div style={{ position: "relative", width: 96, height: 96, flexShrink: 0 }}>
              <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
                <circle cx="48" cy="48" r="38" fill="none" stroke="#FFFFFF" strokeWidth="12" />
                <circle cx="48" cy="48" r="38" fill="none" strokeWidth="12" transform="rotate(-90 48 48)" style={{ stroke: ring, strokeDasharray: ringDash(fs.ring, 38) }} />
              </svg>
              <div style={{ position: "absolute", left: 0, top: 0, width: 96, height: 96, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{fs.shown}</span>
                <span style={{ fontSize: 10, color: color.subtle }}>accuracy</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {rows.map((c) => (
                <span key={c.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
                  <span style={{ minWidth: 24, height: 24, borderRadius: 7, background: c.bg, color: "#FFFFFF", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.n}</span>
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {shown.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {shown.map((f) => <FactCard key={f.id} f={f} />)}
          </div>
        ) : (
          <EmptyState tone="good" title="No wrong facts found">
            Every fact we checked about your prices, hours and services was correct. We’ll keep watching as AI tools update.
          </EmptyState>
        )}

        <NoteBox>
          <p style={{ margin: 0 }}>Wrong facts cost you twice: a customer arrives expecting the wrong price or a service you don’t offer, and AI keeps repeating the mistake until the site it read is fixed. Fixing your own site alone isn’t enough.</p>
        </NoteBox>
      </ReportPage>

      <SeeAll hiddenCount={rest.length} noun="wrong facts">
        {chunks.map((chunk, ci) => (
          <ReportPage key={ci} r={r} ctx={ctx} section={section(ctx)} continued>
            <span style={text.label}>
              Wrong facts {span(starts[ci], chunk.length, wrong.length)}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {chunk.map((f) => <FactCard key={f.id} f={f} />)}
            </div>
          </ReportPage>
        ))}
      </SeeAll>
    </>
  );
}
