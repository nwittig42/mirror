import type { FactCheck, Severity } from "@/report/types";
import {
  EmptyState, PageTitle, Pill, ReportPage, ScoreRing, StatusDot, ToolBadge, card, text, type PageProps,
} from "@/report/components";
import { SeeAll } from "@/report/see-all";
import { factScoreView, headlines, severityCounts, sortedWrongFacts } from "@/report/scoring";
import { color, statusColor, toolMeta } from "@/report/tokens";

/** Up to 3 facts on the sheet (fewer if long text would overflow it), up to 4 per continuation sheet. */
const FACTS_MAX_ON_SHEET = 3;
const FACTS_MAX_PER_CONTINUATION = 4;
/** Usable content height of a sheet, with a safety margin. */
const SHEET_BUDGET = 880 - 12;
/** The title block with the accuracy card, and the closing line, on the first sheet. */
const HEAD_HEIGHT = 150;
const FOOT_HEIGHT = 40;
const GAP = 18;
const CARD_GAP = 12;

const lines = (chars: number, perLine: number) => Math.max(1, Math.ceil(chars / perLine));

/** Card height from its text, so a sheet never takes more cards than fit. */
function cardHeight(f: FactCheck) {
  const box = 44 + 20 * Math.max(lines((f.aiSaid ?? "").length + 2, 34), lines(f.truth.length, 32));
  const fix = f.fix ? 10 + 19 * lines(f.fix.length + 15, 88) : 0;
  const chips = (f.sources ?? []).reduce((a, s) => a + s.length * 7.5 + 28, 130);
  return 30 + 22 + 10 + box + fix + 10 + 24 + 26 * (lines(chips, 640) - 1);
}

/** Split facts into sheets by height: the first sheet gets `first` px, the others `rest` px. */
function pack(facts: FactCheck[], first: number, rest: number) {
  const out: FactCheck[][] = [];
  let cur: FactCheck[] = [];
  let used = 0;
  for (const f of facts) {
    const h = cardHeight(f) + CARD_GAP;
    const max = out.length === 0 ? FACTS_MAX_ON_SHEET : FACTS_MAX_PER_CONTINUATION;
    const budget = (out.length === 0 ? first : rest) + CARD_GAP;
    if (cur.length && (cur.length >= max || used + h > budget)) { out.push(cur); cur = []; used = 0; }
    cur.push(f); used += h;
  }
  out.push(cur);
  return out;
}

const SEV: Record<Severity, { label: string; bg: string; fg: string }> = {
  critical: { label: "Serious", bg: statusColor.bad.fill, fg: color.surface },
  major: { label: "Important", bg: statusColor.bad.soft, fg: statusColor.bad.text },
  minor: { label: "Minor", bg: color.track, fg: color.body },
};

/** "4 to 6 of 9", or "4 of 4" for a single item. */
const span = (start: number, count: number, total: number) =>
  count > 1 ? `${start + 1} to ${start + count} of ${total}` : `${start + 1} of ${total}`;

const SECTION = "What AI gets wrong about you";

function FactCard({ f }: { f: FactCheck }) {
  const sev = SEV[f.severity ?? "minor"];
  const sources = f.sources ?? [];
  return (
    <div style={{ ...card, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{f.topic}</span>
        <Pill bg={sev.bg} fg={sev.fg}>{sev.label}</Pill>
        {f.isPrice && <Pill bg={color.surface} fg={statusColor.bad.text} style={{ border: `1px solid ${statusColor.bad.fill}` }}>Price</Pill>}
        {f.tool && (
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: color.muted }}>
            Said by <ToolBadge tool={f.tool} size={18} /><span style={{ fontWeight: 600, color: color.ink }}>{toolMeta[f.tool].name}</span>
          </span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "stretch" }}>
        <div style={{ background: statusColor.bad.soft, borderRadius: 12, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <StatusDot status="bad" size={20} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ ...text.label, color: statusColor.bad.text }}>AI said</span>
            <span style={{ fontSize: 14.5, lineHeight: "20px", overflowWrap: "anywhere" }}>“{f.aiSaid ?? ""}”</span>
          </div>
        </div>
        <div style={{ background: statusColor.good.soft, borderRadius: 12, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <StatusDot status="good" size={20} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ ...text.label, color: statusColor.good.text }}>The truth</span>
            <span style={{ fontSize: 14.5, lineHeight: "20px", fontWeight: 600, overflowWrap: "anywhere" }}>{f.truth}</span>
          </div>
        </div>
      </div>
      {f.fix && (
        <div style={{ fontSize: 13, lineHeight: "19px", color: color.body }}>
          <strong style={{ fontWeight: 600, color: color.clientText }}>How to fix it:</strong> {f.fix}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", minHeight: 24 }}>
        <span style={text.label}>Where AI read it</span>
        {sources.length ? sources.map((s) => (
          <span key={s} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 99, background: color.track, fontWeight: 500, color: color.ink }}>{s}</span>
        )) : <span style={text.small}>The AI tool did not say where it read this.</span>}
      </div>
    </div>
  );
}

/** Page 4 of the full report: the Accuracy score, and each wrong fact with the truth and the fix. */
export function WrongFactsPage({ r, ctx }: PageProps) {
  const wrong = sortedWrongFacts(r.facts);
  const sheets = pack(wrong, SHEET_BUDGET - HEAD_HEIGHT - FOOT_HEIGHT - 2 * GAP, SHEET_BUDGET - 17 - GAP);
  const shown = sheets[0];
  const rest = wrong.slice(shown.length);
  const chunks = sheets.slice(1);
  const starts = chunks.map((_, ci) => shown.length + chunks.slice(0, ci).reduce((a, c) => a + c.length, 0));
  const counts = severityCounts(r.facts);
  const fs = factScoreView(r.scores.factAccuracy);
  const tally = [
    { name: "serious", n: counts.critical },
    { name: "important", n: counts.major },
    { name: "minor", n: counts.minor },
  ];

  return (
    <>
      <ReportPage r={r} ctx={ctx} section={SECTION} gap={GAP}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 270px", gap: 20, alignItems: "center", minHeight: HEAD_HEIGHT - 20 }}>
          <PageTitle eyebrow="Accuracy" title="What AI gets wrong about you">{headlines(r).facts}</PageTitle>
          <div style={{ ...card, background: color.panel, borderColor: color.panel, padding: 14, display: "flex", gap: 14, alignItems: "center" }}>
            <ScoreRing value={fs.ring} size={88} width={9} strokeColor={fs.colors.fill} trackColor={color.surface}>
              <span style={{ ...text.stat, fontSize: r.scores.factAccuracy === null ? 18 : 26 }}>{fs.shown}</span>
              <span style={{ fontSize: 10, color: color.muted, marginTop: 2 }}>Accuracy</span>
            </ScoreRing>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {tally.map((c) => (
                <span key={c.name} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13, color: color.body }}>
                  <strong style={{ minWidth: 14, fontSize: 16, fontWeight: 600, color: c.n ? color.ink : color.muted }}>{c.n}</strong>{c.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {shown.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: CARD_GAP }}>
            {shown.map((f) => <FactCard key={f.id} f={f} />)}
          </div>
        ) : (
          <EmptyState tone="good" title="No wrong facts found">
            {r.facts.length
              ? "Every fact we checked about your prices, hours and services was correct. We keep watching as AI tools update."
              : "No facts were checked in this scan. Once your fact sheet is confirmed, wrong facts show up here."}
          </EmptyState>
        )}

        <p style={{ ...text.small, margin: "auto 0 0", paddingBottom: 12 }}>
          A wrong fact costs you twice. A customer arrives expecting the wrong price or a service you do not offer, and AI keeps repeating it until the site it read is fixed.
          {rest.length > 0 && ` ${rest.length} more wrong ${rest.length === 1 ? "fact is" : "facts are"} listed after this page.`}
        </p>
      </ReportPage>

      <SeeAll hiddenCount={rest.length} noun="wrong facts">
        {chunks.map((chunk, ci) => (
          <ReportPage key={ci} r={r} ctx={ctx} section={SECTION} gap={GAP} continued>
            <span style={text.label}>Wrong facts {span(starts[ci], chunk.length, wrong.length)}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: CARD_GAP }}>
              {chunk.map((f) => <FactCard key={f.id} f={f} />)}
            </div>
          </ReportPage>
        ))}
      </SeeAll>
    </>
  );
}
