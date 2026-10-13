import { Bar, NumberDot, ReportPage, card, clamp, joinNames, panel, text, type PageProps } from "@/report/components";
import { actionsFor } from "@/report/scoring";
import { color, statusColor, toolMeta } from "@/report/tokens";

// The prospect email imports this from here.
export { joinNames };

/**
 * The one-page summary, written for a busy owner who isn't technical: are
 * they losing customers to AI, to whom, the proof in AI's own words, why it
 * matters, and the three changes that help most. For a prospect (facts not
 * yet reviewed) the fact check is held back for the call.
 */
export function OnePageSummaryPage({ r, ctx }: PageProps) {
  const answers = r.scan.buyerQuestionCount * r.scan.runsPerQuestion * r.scan.tools.length;
  const named = r.leaderboard.find(e => e.isClient)?.count ?? 0;
  const comp = r.topCompetitor;
  const city = r.business.location.split(",")[0];
  const category = r.business.category.toLowerCase();
  const fixes = actionsFor(r.prospect ? "visibility" : "master", r).slice(0, 3);
  const max = Math.max(1, named, comp.namedCount);
  const q = r.missedQuote;
  const later = "After our call";

  const scores = [
    { label: "Overall", value: r.prospect ? null : r.scores.overall.value },
    { label: "Recommended by AI", value: r.scores.visibility },
    { label: "Accuracy", value: r.prospect ? null : r.scores.factAccuracy },
  ];

  return (
    <ReportPage r={r} ctx={ctx} section="Summary" gap={16}>
      <h1 style={text.h1}>
        What AI tells people looking for a {category} in {city}
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.35 }}>
          You came up in {named} of {answers} answers. {comp.name} came up in {comp.namedCount}.
        </p>
        {[{ who: r.business.name, n: named, c: color.client, you: true }, { who: comp.name, n: comp.namedCount, c: color.competitor, you: false }].map(b => (
          <div key={b.who} style={{ display: "grid", gridTemplateColumns: "150px 1fr 34px", alignItems: "center", gap: 10, fontSize: 13 }}>
            <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.who}</span>
            <Bar pct={Math.max(2, (b.n / max) * 100)} fill={b.c} height={12} track={color.panel} />
            <span style={{ fontWeight: 600, textAlign: "right", color: b.you ? color.clientText : color.ink }}>{b.n}</span>
          </div>
        ))}
      </div>

      {q && (
        <div style={{ ...panel, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 13, color: color.muted }}>
            We asked {toolMeta[q.tool].name}: <strong style={{ color: color.ink, fontWeight: 600 }}>&ldquo;{q.question}&rdquo;</strong>
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: color.ink, ...clamp(r.prospect ? 3 : 4) }}>&ldquo;{q.text}&rdquo;</p>
          <div style={{ fontSize: 13, fontWeight: 600, color: statusColor.bad.text }}>
            {r.business.name} wasn&apos;t mentioned. It named {joinNames(q.named)}.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        {scores.map(s => (
          <div key={s.label} style={{ ...card, padding: "10px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={text.label}>{s.label}</span>
            {s.value === null ? (
              <span style={{ fontSize: 15, fontWeight: 600, lineHeight: "30px", color: color.muted }}>{r.prospect ? later : "Not checked"}</span>
            ) : (
              <span style={{ ...text.stat, fontSize: 30 }}>{s.value}<span style={{ fontSize: 13, fontWeight: 500, letterSpacing: 0, color: color.muted }}>/100</span></span>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={text.h2}>Why this matters</div>
        <p style={{ ...text.body, fontSize: 14 }}>
          More people now ask an AI assistant instead of searching Google. If it doesn&apos;t name you, those
          customers never see you, and they go to whoever it did name.
        </p>
      </div>

      <div>
        <div style={text.h2}>The three changes that would help most</div>
        <div style={{ margin: "10px 0 0", display: "flex", flexDirection: "column", gap: 9 }}>
          {fixes.map((f, i) => (
            <div key={f.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14, lineHeight: 1.4 }}>
              <NumberDot n={i + 1} tone="gold" size={22} />
              <span style={clamp(2)}><strong style={{ fontWeight: 600 }}>{f.title}.</strong> <span style={{ color: color.body }}>{f.why}</span></span>
            </div>
          ))}
        </div>
      </div>

      {r.prospect && (
        <p style={text.body}>
          We also checked what AI says about your prices, services and hours. Before we show you, we&apos;ll confirm
          your details with you, so nothing here is a guess.
        </p>
      )}

      <div style={{ marginTop: "auto", borderTop: `1px solid ${color.rule}`, paddingTop: 12, paddingBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {r.prospect ? "Next: a 30-minute call to set up your fact sheet" : "Next: we start on the changes above"}
          </div>
          <div style={text.small}>
            {r.prospect ? "We confirm your prices, services and hours, then show you what AI gets right and wrong." : "Your dashboard shows progress every week."}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 13 }}>
          <div style={{ fontWeight: 600 }}>{r.contact.name}</div>
          {r.contact.email && <div style={{ color: color.body }}>{r.contact.email}</div>}
          {r.contact.bookingUrl && <div style={{ color: color.clientText }}>{r.contact.bookingUrl.replace(/^https?:\/\//, "")}</div>}
        </div>
      </div>
    </ReportPage>
  );
}
