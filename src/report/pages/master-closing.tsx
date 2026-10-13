import { CheckIcon, EmptyState, PageTitle, ReportPage, card, clamp, joinNames, panel, text, type PageProps } from "@/report/components";
import { color, statusColor } from "@/report/tokens";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Short names for the score parts, used in the "Overall" definition. */
const PART_SHORT: Record<string, string> = {
  named_often: "how often you are named",
  rank_high: "how high you rank",
  tool_reach: "how many AI tools name you",
  accuracy: "Accuracy",
};

/** Last page of the full report: how the numbers were made, and what happens next. */
export function ClosingPage({ r, ctx }: PageProps) {
  const { tools, buyerQuestionCount: buyerQ, brandedQuestionCount: brandedQ, runsPerQuestion: runs } = r.scan;
  const questions = buyerQ + brandedQ;
  const totalAnswers = tools.length * questions * runs;
  const buyerAnswers = tools.length * buyerQ * runs;
  const brandedAnswers = tools.length * brandedQ * runs;
  const comps = r.scores.components;
  const hasWrongFacts = r.facts.some(f => !f.isTrue);
  const phases = r.plan90;
  const contactLine = [r.contact.name, r.contact.email, r.contact.phone].filter(Boolean).join("  ·  ");

  const sums = [
    { n: tools.length, label: plural(tools.length, "AI tool", "AI tools"), op: "×" },
    { n: questions, label: plural(questions, "question", "questions"), op: "×" },
    { n: runs, label: plural(runs, "time each", "times each"), op: "=" },
    { n: totalAnswers, label: "answers read", op: "" },
  ];

  const words = [
    { term: "Overall", def: `Out of 100 points: ${joinNames(comps.map(c => `${c.weight} for ${PART_SHORT[c.id] ?? c.label.toLowerCase()}`))}.` },
    {
      term: "Recommended by AI",
      def: `How often and how high AI names you, from 0 to 100. It comes from the ${buyerAnswers} answers to the ${buyerQ} ${plural(buyerQ, "question that does not", "questions that do not")} use your name.`,
    },
    {
      term: "Accuracy",
      def: `Starts at 100 and loses points for each wrong fact. Serious mistakes and wrong prices cost the most. It comes from the ${brandedAnswers} answers to the ${brandedQ} ${plural(brandedQ, "question", "questions")} about you by name.`,
    },
  ];

  return (
    <ReportPage r={r} ctx={ctx} section="How we measured, and what happens next" gap={16}>
      <PageTitle eyebrow="Behind the numbers" title="How we measured this" />

      <div style={{ ...panel, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {sums.map((s, i) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, flexGrow: 1, justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ ...text.stat, fontSize: 28, color: i === sums.length - 1 ? color.clientText : color.ink }}>{s.n}</span>
              <span style={{ fontSize: 12, color: color.muted }}>{s.label}</span>
            </div>
            {s.op && <span style={{ fontSize: 20, color: color.muted, padding: "0 6px" }} aria-hidden="true">{s.op}</span>}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {words.map(w => (
          <div key={w.term} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, padding: "8px 0", borderBottom: `1px solid ${color.rule}` }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{w.term}</span>
            <span style={{ fontSize: 12.5, lineHeight: 1.45, color: color.body, ...clamp(3) }}>{w.def}</span>
          </div>
        ))}
        <div style={{ ...text.small, padding: "8px 0 0" }}>
          {runs > 1
            ? `AI answers change from one ask to the next, so each question was asked ${runs} times to see what is typical.`
            : "AI answers change from one ask to the next, so this is a picture of a typical day."}
          {r.scan.coverageNote ? ` ${r.scan.coverageNote}` : ""}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
        <span style={{ ...text.label, color: color.clientText }}>What happens next</span>
        <h2 style={{ ...text.h1, fontSize: 22 }}>Your first 90 days with Mirror</h2>
        <p style={text.body}>
          {hasWrongFacts
            ? "We fix what AI gets wrong first, because wrong facts cost you customers today. Then we work on getting you named more often."
            : "AI already gets your facts right, so we go straight to getting you named more often, and keep your facts correct as they change."}
          {` After 90 days we run this same check again, with the same questions and the same AI ${plural(tools.length, "tool", "tools")}, so you can see what changed.`}
        </p>
        {phases.length ? (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(3, phases.length)}, minmax(0, 1fr))`, gap: 12 }}>
            {phases.slice(0, 3).map((p, i) => (
              <div key={`${p.when}-${i}`} style={{ ...card, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={text.label}>{p.when}</span>
                <span style={{ ...text.h2, fontSize: 16 }}>{p.title}</span>
                {p.items.slice(0, 3).map((item, j) => (
                  <div key={j} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, lineHeight: 1.4, color: color.body }}>
                    <span style={{ flexShrink: 0, marginTop: 3 }}><CheckIcon size={12} stroke={statusColor.good.fill} /></span>
                    <span style={clamp(2)}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Your plan is on its way">We walk through the 90-day plan together on the first call.</EmptyState>
        )}
      </div>

      <div style={{ marginTop: "auto", marginBottom: 14, background: color.ink, borderRadius: 16, padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: color.panel }}>
            {hasWrongFacts ? "Start with the facts." : "Start getting named."}
          </span>
          <span style={{ fontSize: 13, lineHeight: 1.45, color: color.clientTint }}>A 20-minute call to confirm your prices, hours and services. We handle the rest.</span>
          {contactLine && <span style={{ fontSize: 12, color: color.rule, overflowWrap: "anywhere" }}>{contactLine}</span>}
        </div>
        {r.contact.bookingUrl && (
          <a href={r.contact.bookingUrl} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", padding: "12px 22px", borderRadius: 99, background: color.client, color: color.surface, fontSize: 14, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
            Book your call
          </a>
        )}
      </div>
    </ReportPage>
  );
}
