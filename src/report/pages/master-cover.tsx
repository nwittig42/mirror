import { Logo, ReportPage, text, FONT_DISPLAY, formatReportDate, type PageProps } from "@/report/components";
import { bandColors, bandLabel, ringDash, scoreBand, variantPages } from "@/report/scoring";
import { color, toolMeta } from "@/report/tokens";

/** "A, B and C". */
function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Story-arc groups on the cover, keyed by the master page ids they span. */
const ARC: { title: string; ids: string[]; color: string; bg: string }[] = [
  { title: "Where you stand", ids: ["summary", "score_and_tools"], color: "#1D4ED8", bg: "#EFF6FF" },
  { title: "Who’s beating you and why", ids: ["competitors", "wins_and_tone", "sources", "searches"], color: "#6D28D9", bg: "#F5F3FF" },
  { title: "What AI gets wrong", ids: ["wrong_facts"], color: "#B91C1C", bg: "#FEF2F2" },
  { title: "What to fix first", ids: ["website_check", "action_plan", "method", "next_step"], color: "#15803D", bg: "#F0FDF4" },
];

function arcPages(ids: string[]): string {
  const nums = ids.map((id) => variantPages.master.indexOf(id) + 1).filter((n) => n > 0);
  if (!nums.length) return "";
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  return lo === hi ? `PAGE ${lo}` : `PAGES ${lo}–${hi}`;
}

const statChip = { background: "#FFFFFF", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "baseline", gap: 8 } as const;

/** Page 1 of the master report: the cover. */
export function CoverPage({ r, ctx }: PageProps) {
  const tools = r.scan.tools.map((t) => ({ id: t, ...toolMeta[t] }));
  const questions = r.scan.buyerQuestionCount + r.scan.brandedQuestionCount;
  const runs = r.scan.runsPerQuestion;
  const answers = questions * runs * tools.length;
  const score = r.scores.overall.value;
  const band = bandColors(scoreBand(score));

  return (
    <ReportPage r={r} ctx={ctx} section="01 · Cover" bare>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo size={40} />
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Mirror</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 99, background: "#F1F5F9", color: "#334155" }}>Master report</span>
      </div>

      <div style={{ marginTop: 72, display: "flex", flexDirection: "column", gap: 16 }}>
        <span style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 99, background: "#DBEAFE", color: "#1D4ED8" }}>AI Visibility Audit</span>
        <h1 style={{ margin: 0, fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: r.business.name.length > 16 ? 64 : 84, lineHeight: 1, letterSpacing: "-0.025em", textWrap: "balance" }}>{r.business.name}</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", fontSize: 18, color: "#475569" }}>
          <span>{r.business.website}</span>
          <span style={{ width: 5, height: 5, borderRadius: 3, background: "#94A3B8", flexShrink: 0 }} />
          <span>{r.business.location}</span>
          <span style={{ width: 5, height: 5, borderRadius: 3, background: "#94A3B8", flexShrink: 0 }} />
          <span>Scanned {formatReportDate(r.scan.date)}</span>
        </div>
      </div>

      <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "1fr 220px", gap: 20 }}>
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 20, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={text.label}>We asked these {tools.length} AI assistants</span>
          <div style={{ display: "flex", justifyContent: tools.length < 5 ? "space-around" : "space-between" }}>
            {tools.map((t) => (
              <div key={t.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 76 }}>
                <span style={{ width: 52, height: 52, borderRadius: 16, background: t.color, color: "#FFFFFF", fontSize: 19, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{t.short}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            <div style={statChip}><span style={{ fontSize: 26, fontWeight: 800, color: "#2563EB" }}>{questions}</span><span style={{ fontSize: 13, color: "#475569" }}>questions</span></div>
            <div style={statChip}><span style={{ fontSize: 26, fontWeight: 800, color: "#7C3AED" }}>{runs}×</span><span style={{ fontSize: 13, color: "#475569" }}>each</span></div>
            <div style={statChip}><span style={{ fontSize: 26, fontWeight: 800, color: "#0D9488" }}>{answers}</span><span style={{ fontSize: 13, color: "#475569" }}>answers</span></div>
          </div>
        </div>
        <div style={{ border: "1px solid #E2E8F0", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span style={text.label}>Overall score</span>
          <div style={{ position: "relative", width: 136, height: 136 }}>
            <svg width="136" height="136" viewBox="0 0 136 136" aria-hidden="true">
              <circle cx="68" cy="68" r="56" fill="none" stroke="#F1F5F9" strokeWidth="16" />
              <circle cx="68" cy="68" r="56" fill="none" strokeWidth="16" transform="rotate(-90 68 68)" style={{ stroke: band.fill, strokeDasharray: ringDash(score, 56) }} />
            </svg>
            <div style={{ position: "absolute", left: 0, top: 0, width: 136, height: 136, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{score}</span>
              <span style={{ fontSize: 12, color: "#64748B" }}>of 100</span>
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 99, background: band.tint, color: band.text }}>{bandLabel[scoreBand(score)]}</span>
        </div>
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 14, color: "#475569" }}>
        Checked across {listJoin(tools.map((t) => t.name))} · {questions} questions · each asked {runs === 1 ? "once" : `${runs} times`}
      </p>

      <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={text.label}>Inside this report</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          {ARC.map((a) => (
            <div key={a.title} style={{ borderRadius: 14, padding: 14, background: a.bg, display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: a.color }}>{arcPages(a.ids)}</span>
              <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{a.title}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flexGrow: 1 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", fontSize: 12, color: color.subtle }}>
        <span>Prepared for {r.business.name} by Mirror</span>
        <span>mirror · AI Visibility Audit</span>
      </div>
      <div style={{ display: "flex", height: 14, margin: "0 -64px" }}>
        {tools.map((t) => <div key={t.id} style={{ flexGrow: 1, background: t.color }} />)}
      </div>
    </ReportPage>
  );
}
