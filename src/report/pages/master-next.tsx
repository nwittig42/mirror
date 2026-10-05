import { EmptyState, FONT_DISPLAY, ReportPage, StagePill, nn, type PageProps } from "@/report/components";
import { color, statusColor } from "@/report/tokens";

const VIOLET = "#7C3AED";
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

const MARKS = [
  { left: 0, color: color.client, label: "DAY 1" },
  { left: 33, color: color.client, label: "DAY 30" },
  { left: 66.5, color: statusColor.good.fill, label: "DAY 60" },
  { left: 100, color: VIOLET, label: "DAY 90 · RE-CHECK" },
];

const PHASE_COLORS = [
  { color: color.client, soft: color.clientSoft },
  { color: statusColor.good.fill, soft: statusColor.good.soft },
  { color: VIOLET, soft: "#F5F3FF" },
];

export function NextPage({ r, ctx }: PageProps) {
  const hasWrongFacts = r.facts.some(f => !f.isTrue);
  const toolCount = r.scan.tools.length;
  const phases = r.plan90;
  const contactLine = [r.contact.name, r.contact.email, r.contact.phone].filter(Boolean).join(" · ");
  const cols = phases.length === 2 ? "1fr 2fr" : `repeat(${Math.max(1, phases.length)}, minmax(0, 1fr))`;

  return (
    <ReportPage r={r} ctx={ctx} section={`${nn(ctx.index)} · Next step`} gap={26}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 6 }}>
        <StagePill stage="fix">Next step</StagePill>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: 40, lineHeight: 1.12, margin: 0, letterSpacing: "-0.015em", textWrap: "balance" }}>
          What Mirror fixes in your first 90 days
        </h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: color.muted, maxWidth: 560 }}>
          {hasWrongFacts
            ? "We fix what AI gets wrong first, because wrong facts cost you customers today. Then we work on getting you named more often."
            : "AI already gets your facts right, so we go straight to getting you named more often, and keep your facts correct as they change."}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", height: 54, margin: "0 12px" }} aria-hidden="true">
          <div style={{ position: "absolute", left: 0, right: 0, top: 16, height: 4, borderRadius: 2, background: color.rule }} />
          <div style={{ position: "absolute", left: 0, width: "33%", top: 16, height: 4, borderRadius: 2, background: color.client }} />
          <div style={{ position: "absolute", left: "33.5%", right: 0, top: 16, height: 4, borderRadius: 2, background: statusColor.good.fill }} />
          {MARKS.map(m => (
            <span key={m.label}>
              <span style={{ position: "absolute", left: `${m.left}%`, transform: "translateX(-50%)", top: 6, width: 24, height: 24, borderRadius: 12, background: m.color, border: "3px solid #FFFFFF", boxSizing: "border-box", boxShadow: `0 0 0 2px ${m.color}` }} />
              <span style={{ position: "absolute", left: `${m.left}%`, transform: "translateX(-50%)", top: 38, fontSize: 11, fontWeight: 800, color: color.muted, whiteSpace: "nowrap" }}>{m.label}</span>
            </span>
          ))}
        </div>

        {phases.length ? (
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 14 }}>
            {phases.map((p, i) => {
              const c = PHASE_COLORS[Math.min(i, PHASE_COLORS.length - 1)];
              return (
                <div key={`${p.when}-${i}`} style={{ background: c.soft, borderRadius: 18, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 99, background: c.color, color: "#FFFFFF" }}>{p.when}</span>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 26, lineHeight: 1.15 }}>{p.title}</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {p.items.map((item, j) => (
                      <div key={j} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.45, color: color.body }}>
                        <span style={{ flexShrink: 0, marginTop: 2, width: 18, height: 18, borderRadius: 9, background: c.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                        </span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Your plan is on its way">We’ll walk through the 90-day plan together on the kickoff call.</EmptyState>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "16px 20px", border: `2px solid ${color.rule}`, borderRadius: 18 }}>
        <span style={{ flexShrink: 0, width: 48, height: 48, borderRadius: 14, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6D28D9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3L20 9" /><path d="M20 4v5h-5" /><path d="M20 12a8 8 0 0 1-14 5.3L4 15" /><path d="M4 20v-5h5" /></svg>
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>Day 90: we run this same audit again</span>
          <span style={{ fontSize: 13, color: color.muted }}>
            Same questions, same {WORDS[toolCount] ?? toolCount} {toolCount === 1 ? "assistant" : "assistants"}, so you can see exactly how your score rings changed.
          </span>
        </div>
      </div>

      <div style={{ flexGrow: 1 }} />

      <div style={{ background: color.client, borderRadius: 20, padding: "28px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, marginBottom: 22 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <svg width="48" height="48" viewBox="0 0 22 22" aria-hidden="true" style={{ flexShrink: 0 }}>
            <rect width="22" height="22" rx="6" fill="#FFFFFF" />
            <path d="M10 5a6 6 0 0 0 0 12z" fill={color.client} />
            <path d="M12 5a6 6 0 0 1 0 12" fill="none" stroke={color.client} strokeWidth="1.6" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 330 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 28, lineHeight: 1.2, color: "#FFFFFF" }}>
              {hasWrongFacts ? "Start with the facts." : "Start getting named."}
            </span>
            <span style={{ fontSize: 14, lineHeight: 1.5, color: color.clientTint }}>A 20-minute call to confirm your prices, hours and services. We handle the rest.</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
          <a href={r.contact.bookingUrl} style={{ display: "inline-flex", alignItems: "center", minHeight: 46, padding: "0 22px", borderRadius: 12, background: "#FFFFFF", color: color.clientText, fontSize: 15, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}>
            Book your kickoff →
          </a>
          {contactLine && <span style={{ fontSize: 12, color: color.clientTint, textAlign: "right" }}>{contactLine}</span>}
        </div>
      </div>
    </ReportPage>
  );
}
