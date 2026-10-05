import { ReportPage, text, FONT_DISPLAY, type PageProps } from "@/report/components";
import { actionsFor } from "@/report/scoring";
import { color, toolMeta } from "@/report/tokens";
import { ScoreRings, RING_COLORS } from "@/components/score-rings";

/** "A", "A and B", "A, B and C". */
export function joinNames(names: string[]): string {
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

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

  const legend = [
    { label: "Overall", value: r.prospect ? null : r.scores.overall.value, color: RING_COLORS.overall.from },
    { label: "Fact check", value: r.prospect ? null : r.scores.factAccuracy, color: RING_COLORS.facts.from },
    { label: "Ranking", value: r.scores.visibility, color: RING_COLORS.visibility.from },
  ];

  return (
    <ReportPage r={r} ctx={ctx} section="Summary" gap={18}>
      <h1 style={{ ...text.h1, fontSize: 30 }}>
        What AI tells people looking for a {category} in {city}
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.35 }}>
          You came up in {named} of {answers} answers. {comp.name} came up in {comp.namedCount}.
        </p>
        {[{ who: r.business.name, n: named, c: color.client }, { who: comp.name, n: comp.namedCount, c: "#94A3B8" }].map(b => (
          <div key={b.who} style={{ display: "grid", gridTemplateColumns: "150px 1fr 34px", alignItems: "center", gap: 10, fontSize: 13 }}>
            <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.who}</span>
            <div style={{ height: 14, borderRadius: 7, background: "#F1F5F9" }}>
              <div style={{ height: 14, borderRadius: 7, background: b.c, width: `${Math.max(2, (b.n / max) * 100)}%` }} />
            </div>
            <span style={{ fontWeight: 800, textAlign: "right" }}>{b.n}</span>
          </div>
        ))}
      </div>

      {q && (
        <div style={{ background: color.panel, borderRadius: 16, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 13, color: color.subtle }}>
            We asked {toolMeta[q.tool].name}: <strong style={{ color: color.ink }}>&ldquo;{q.question}&rdquo;</strong>
          </div>
          <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontStyle: "italic", fontSize: 18, lineHeight: 1.45 }}>&ldquo;{q.text}&rdquo;</p>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#B91C1C" }}>
            {r.business.name} wasn&apos;t mentioned. It named {joinNames(q.named)}.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "stretch" }}>
        <div style={{ background: "#000", borderRadius: 20, padding: "14px 18px", display: "flex", gap: 16, alignItems: "center" }}>
          <ScoreRings scores={{ overall: legend[0].value, facts: legend[1].value, visibility: legend[2].value }} size={112} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {legend.map(l => (
              <div key={l.label}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#F5F5F7" }}>{l.label}</div>
                <div style={{ fontSize: l.value === null ? 12 : 20, fontWeight: 800, lineHeight: 1.1, color: l.value === null ? "#8E8E93" : l.color }}>
                  {l.value === null ? later : <>{l.value}<span style={{ fontSize: 12 }}>/100</span></>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Why this matters</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            More people now ask an AI assistant instead of searching Google. If it doesn&apos;t name you, those
            customers never see you, and they go to whoever it did name.
          </p>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>The three changes that would help most</div>
        <ol style={{ margin: "8px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {fixes.map(f => (
            <li key={f.id} style={{ fontSize: 14, lineHeight: 1.4 }}>
              <strong>{f.title}.</strong> <span style={{ color: "#475569" }}>{f.why}</span>
            </li>
          ))}
        </ol>
      </div>

      {r.prospect && (
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#475569" }}>
          We also checked what AI says about your prices, services and hours. Before we show you, we&apos;ll confirm
          your details with you, so nothing here is a guess.
        </p>
      )}

      <div style={{ marginTop: "auto", borderTop: `1px solid ${color.rule}`, paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>
            {r.prospect ? "Next: a 30-minute call to set up your fact sheet" : "Next: we start on the changes above"}
          </div>
          <div style={text.small}>
            {r.prospect ? "We confirm your prices, services and hours, then show you what AI gets right and wrong." : "Your dashboard shows progress every week."}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 13 }}>
          <div style={{ fontWeight: 700 }}>{r.contact.name}</div>
          {r.contact.email && <div>{r.contact.email}</div>}
          {r.contact.bookingUrl && <div style={{ color: color.clientText }}>{r.contact.bookingUrl.replace(/^https?:\/\//, "")}</div>}
        </div>
      </div>
    </ReportPage>
  );
}
