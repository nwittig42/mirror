import { ReportPage, StagePill, nn, text, FONT_DISPLAY, type PageProps } from "@/report/components";
import { color, statusColor, toolMeta } from "@/report/tokens";

const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const word = (n: number) => WORDS[n] ?? String(n);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Short names for the score parts, used in the glossary. */
const PART_SHORT: Record<string, string> = {
  named_often: "being named",
  rank_high: "rank",
  tool_reach: "tool reach",
  accuracy: "accuracy",
};

function joinAnd(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function MethodPage({ r, ctx }: PageProps) {
  const { tools, buyerQuestionCount: buyerQ, brandedQuestionCount: brandedQ, runsPerQuestion: runs } = r.scan;
  const questions = buyerQ + brandedQ;
  const totalAnswers = tools.length * questions * runs;
  const buyerAnswers = tools.length * buyerQ * runs;
  const brandedAnswers = tools.length * brandedQ * runs;
  const comps = r.scores.components;
  const accWeight = comps.filter(c => c.id === "accuracy").reduce((s, c) => s + c.weight, 0);
  const visWeight = comps.filter(c => c.id !== "accuracy").reduce((s, c) => s + c.weight, 0);
  const { min, max } = r.scores.overall;

  const inputs = [
    { n: tools.length, label: plural(tools.length, "AI assistant", "AI assistants"), color: "#7C3AED", op: "×" },
    { n: questions, label: plural(questions, "real question", "real questions"), color: "#0D9488", op: "×" },
    { n: runs, label: plural(runs, "run each", "runs each"), color: "#E8590C", op: "=" },
  ];

  const names = tools.map(t => toolMeta[t].name);
  const toolExample = names.length > 1 ? `${names[0]} or ${names[names.length - 1]}` : names[0] ?? "an AI assistant";
  const city = r.business.location.split(",")[0];
  const example = r.questions[0]?.text ?? `Where can I find a good ${r.business.category.toLowerCase()} in ${city}?`;

  const steps = [
    { n: 1, color: "#7C3AED", title: "Real buyer questions", body: `What a new customer types into ${toolExample}, like “${example}”` },
    runs > 1
      ? {
        n: 2, color: "#0D9488", title: `Asked ${runs} time${runs === 1 ? "" : "s"} each`,
        body: `AI answers vary. ${word(runs)} runs show what’s typical${min !== max ? `, which is why your score is a range (${min}–${max})` : ""}.`,
      }
      : { n: 2, color: "#0D9488", title: "Asked once each", body: "AI answers vary, so one run is a snapshot of a typical day, not an average." },
    { n: 3, color: color.client, title: "Your name is left out of visibility", body: "If a question already names you, AI will mention you. Those count only toward accuracy." },
    { n: 4, color: statusColor.good.fill, title: "Sources and searches traced", body: "When an assistant showed its sources or web searches, we recorded them to find what to fix." },
  ];

  const scoreParts = joinAnd(comps.map(c => `${c.weight} for ${PART_SHORT[c.id] ?? c.label.toLowerCase()}`));
  const glossary = [
    { term: "Answer", def: "One reply from one AI assistant to one question, in one run." },
    { term: "Named", def: "The answer mentions your business by name." },
    { term: "Rank", def: "Your spot on AI’s list. #1 means named first." },
    { term: "Overall score", def: `Out of 100 points: ${scoreParts}.` },
    { term: "Visibility", def: "How often and how high AI names you, 0–100. Questions with your name don’t count." },
    { term: "Fact accuracy", def: "Starts at 100 and loses points for each wrong fact still open (critical 25, major 12, minor 4; price errors count 1.5x)." },
    { term: "Source", def: "A website AI points to as where it read something." },
    { term: "Severity", def: "Critical: could lose a customer. Major: clearly wrong. Minor: small detail." },
  ];

  return (
    <ReportPage r={r} ctx={ctx} section={`${nn(ctx.index)} · How we measured this`} gap={20}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <StagePill stage="method">Behind the numbers</StagePill>
        <h1 style={text.h1}>How we measured this</h1>
      </div>
      {r.scan.coverageNote && <p style={{ ...text.small, margin: 0, color: "#B45309", fontWeight: 700 }}>{r.scan.coverageNote}</p>}

      <div style={{ background: color.panel, borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {inputs.map(i => (
            <div key={i.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ background: "#FFFFFF", border: `2px solid ${i.color}`, borderRadius: 14, padding: "10px 16px", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 110 }}>
                <span style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: i.color }}>{i.n}</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{i.label}</span>
              </div>
              <span style={{ fontSize: 22, fontWeight: 800, color: color.competitorDark }} aria-hidden="true">{i.op}</span>
            </div>
          ))}
          <div style={{ background: color.ink, borderRadius: 14, padding: "10px 16px", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 110 }}>
            <span style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: "#FFFFFF" }}>{totalAnswers}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: color.competitor }}>answers read</span>
          </div>
        </div>
        <svg width="648" height="40" viewBox="0 0 648 40" aria-hidden="true" style={{ display: "block" }}>
          <path d="M324 0 V14 H162 V36" fill="none" stroke={color.client} strokeWidth="2.5" />
          <path d="M324 14 H486 V36" fill="none" stroke={statusColor.good.fill} strokeWidth="2.5" />
          <path d="M156 30 L162 38 L168 30" fill="none" stroke={color.client} strokeWidth="2.5" />
          <path d="M480 30 L486 38 L492 30" fill="none" stroke={statusColor.good.fill} strokeWidth="2.5" />
        </svg>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
          <div style={{ background: color.clientSoft, borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: color.clientText }}>{buyerAnswers} ANSWERS → VISIBILITY · {visWeight} PTS</span>
            <span style={{ fontSize: 13.5, lineHeight: 1.45 }}>{buyerQ} buyer {plural(buyerQ, "question that doesn’t", "questions that don’t")} name you. Did AI name you, and how high?</span>
          </div>
          <div style={{ background: statusColor.good.soft, borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: statusColor.good.text }}>{brandedAnswers} ANSWERS → FACT ACCURACY · {accWeight} PTS</span>
            <span style={{ fontSize: 13.5, lineHeight: 1.45 }}>{brandedQ} {plural(brandedQ, "question", "questions")} about you by name. Did AI get your prices, hours and services right?</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 24, rowGap: 14 }}>
        {steps.map(s => (
          <div key={s.n} style={{ display: "grid", gridTemplateColumns: "30px 1fr", gap: 12, alignItems: "start" }}>
            <span style={{ width: 28, height: 28, borderRadius: 9, background: s.color, color: "#FFFFFF", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.n}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{s.title}</span>
              <span style={{ fontSize: 13, lineHeight: 1.45, color: color.text2 }}>{s.body}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: color.rule }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: 24, lineHeight: 1.2, margin: 0 }}>Words in this report</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 24, rowGap: 8 }}>
          {glossary.map(g => (
            <div key={g.term} style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 10, paddingBottom: 8, borderBottom: `1px solid ${color.track}` }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>{g.term}</span>
              <span style={{ fontSize: 12.5, lineHeight: 1.4, color: color.text2 }}>{g.def}</span>
            </div>
          ))}
        </div>
      </div>
    </ReportPage>
  );
}
