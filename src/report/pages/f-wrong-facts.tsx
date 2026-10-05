import type { FactCheck, Severity } from "@/report/types";
import { ReportPage, EmptyState, ToolBadge, text, nn, type PageProps } from "@/report/components";
import { severityCounts, sortedWrongFacts } from "@/report/scoring";
import { color, statusColor, toolMeta } from "@/report/tokens";
import { SeeAll } from "@/report/see-all";

const SEV: Record<Severity, { bg: string; fg: string; label: string }> = {
  critical: { bg: "#DC2626", fg: "#FFFFFF", label: "Critical" },
  major: { bg: "#F59E0B", fg: "#0F172A", label: "Major" },
  minor: { bg: "#E2E8F0", fg: "#334155", label: "Minor" },
};

const FIRST_SHEET = 3;
const PER_SHEET = 4;

function WrongFactCard({ f }: { f: FactCheck }) {
  const sev = SEV[f.severity ?? "minor"];
  const sources = f.sources ?? [];
  return (
    <div style={{ border: `1px solid ${color.rule}`, borderRadius: 18, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 1px 2px rgba(15,23,42,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 99, background: sev.bg, color: sev.fg }}>{sev.label}</span>
        {f.isPrice && (
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 99, border: "2px solid #DC2626", color: "#B91C1C" }}>$ Price</span>
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
          <span aria-hidden="true" style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 12, background: statusColor.bad.fill, color: "#FFFFFF", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ ...text.label, color: statusColor.bad.text }}>False · AI said</span>
            <span style={{ fontSize: 15, lineHeight: 1.35, overflowWrap: "anywhere" }}>“{f.aiSaid ?? "Something different"}”</span>
          </div>
        </div>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h13" /><path d="M13 6l6 6-6 6" /></svg>
        <div style={{ background: statusColor.good.soft, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span aria-hidden="true" style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 12, background: statusColor.good.fill, color: "#FFFFFF", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ ...text.label, color: statusColor.good.text }}>True · the real answer</span>
            <span style={{ fontSize: 15, lineHeight: 1.35, fontWeight: 800, overflowWrap: "anywhere" }}>{f.truth}</span>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={text.label}>Where AI read it</span>
          {sources.map((s) => (
            <span key={s} style={{ fontSize: 12.5, padding: "3px 10px", borderRadius: 99, background: color.track, fontWeight: 700 }}>{s}</span>
          ))}
          {sources.length === 0 && <span style={text.small}>Not shown by the assistant</span>}
        </div>
        {f.fix ? (
          <span style={{ fontSize: 12.5, lineHeight: 1.4, color: color.body }}><strong style={{ color: color.clientText }}>Fix:</strong> {f.fix}</span>
        ) : <span />}
      </div>
    </div>
  );
}

function CardList({ facts }: { facts: FactCheck[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {facts.map((f) => <WrongFactCard key={f.id} f={f} />)}
    </div>
  );
}

export function FWrongFactsPage({ r, ctx }: PageProps) {
  const section = `${nn(ctx.index)} · What AI gets wrong`;
  const errors = sortedWrongFacts(r.facts);
  const counts = severityCounts(r.facts);
  const prices = errors.filter((e) => e.isPrice).length;
  const take = errors.length
    ? `${errors.length} false fact${errors.length > 1 ? "s" : ""}${prices ? ", price errors first" : ""}. Each one shows where AI read it and how to fix it.`
    : "AI got every fact we checked right.";

  const first = errors.slice(0, FIRST_SHEET);
  const rest = errors.slice(FIRST_SHEET);
  const more: FactCheck[][] = [];
  for (let i = 0; i < rest.length; i += PER_SHEET) more.push(rest.slice(i, i + PER_SHEET));

  const tiles = [
    { name: "Critical", n: counts.critical, bg: "#DC2626" },
    { name: "Major", n: counts.major, bg: "#D97706" },
    { name: "Minor", n: counts.minor, bg: "#94A3B8" },
  ];

  return (
    <>
      <ReportPage r={r} ctx={ctx} section={section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 11px", borderRadius: 99, background: "#FEE2E2", color: "#B91C1C" }}>What AI gets wrong</span>
            <h1 style={text.h1}>The false facts, up close</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {tiles.map((c) => (
              <div key={c.name} style={{ minWidth: 70, padding: "8px 12px", borderRadius: 12, background: c.bg, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, color: "#FFFFFF" }}>{c.n}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#FFFFFF" }}>{c.name}</span>
              </div>
            ))}
          </div>
        </div>
        <p style={text.take}>{take}</p>

        {errors.length ? (
          <CardList facts={first} />
        ) : (
          <EmptyState tone="good" title="No false facts found">
            Every fact we checked about your prices, hours and services was correct.
          </EmptyState>
        )}
      </ReportPage>

      <SeeAll hiddenCount={rest.length} noun="wrong facts">
        {more.map((facts, i) => (
          <ReportPage key={i} r={r} ctx={ctx} section={section} continued>
            <CardList facts={facts} />
          </ReportPage>
        ))}
      </SeeAll>
    </>
  );
}
