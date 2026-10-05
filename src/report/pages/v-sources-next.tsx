import { FONT_DISPLAY, EmptyState, ReportPage, nn, text, type PageProps } from "@/report/components";
import { bandColors, conicDonut, rateBand, sourceSlices } from "@/report/scoring";
import { sourceColor, sourceLabel } from "@/report/tokens";
import type { AuditReport, OutreachSite, SourceType } from "@/report/types";
import { SeeAll } from "@/report/see-all";
import { joinAnd } from "@/report/pages/v-cover";

const FIRST_SHEET_OUTREACH = 5;
const CONT_PER_SHEET = 30; // 6 rows of 5 cards

/** How the takeaway names each source type. */
const readsLabel: Record<SourceType, string> = {
  articles: "articles",
  reviews_directories: "review sites",
  reddit_social: "Reddit and social posts",
  own_website: "your website",
  google: "Google",
  reference: "reference sites",
};

const WORD_COLORS = ["#7C3AED", "#0D9488", "#E8590C", "#DB2777"];

function takeLine(r: AuditReport): string {
  const own = r.sources.ownSiteCitedPct;
  const top = [...r.sources.types].filter((t) => t.type !== "own_website" && t.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 2);
  const lead = top.length ? `AI mostly reads ${joinAnd(top.map((t) => readsLabel[t.type]))}. ` : "";
  return `${lead}Your own website shows up in ${own < 20 ? "just " : ""}${own}% of answers.`;
}

function OutreachGrid({ sites }: { sites: OutreachSite[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }}>
      {sites.map((o) => (
        <div key={o.domain} style={{ background: "#F5F3FF", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: o.domain.length > 14 ? 12 : 13, fontWeight: 800, overflowWrap: "anywhere" }}>{o.domain.split(".").map((part, i) => <span key={i}>{i > 0 && <wbr />}{i > 0 ? "." : ""}{part}</span>)}</span>
          <span style={{ fontSize: 11.5, lineHeight: 1.35, color: "#334155", display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{o.ask}</span>
        </div>
      ))}
    </div>
  );
}

function OutreachHeader() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="#7C3AED" /></svg>
      <span style={{ fontSize: 15, fontWeight: 800 }}>Your outreach list: sites AI read when a competitor won</span>
    </div>
  );
}

export function VSourcesNextPage({ r, ctx }: PageProps) {
  const section = `${nn(ctx.index)} · Where AI looks`;
  const own = r.sources.ownSiteCitedPct;
  const ownColor = bandColors(rateBand(own)).text;
  const types = r.sources.types.filter((t) => t.pct > 0);
  const donut = types.length ? conicDonut(sourceSlices(types)) : "#E2E8F0";
  const words = r.searches.addedWords.slice(0, 6);
  const outreach = r.sources.competitorWinSites;
  const first = outreach.slice(0, FIRST_SHEET_OUTREACH);
  const rest = outreach.slice(FIRST_SHEET_OUTREACH);
  const restSheets: OutreachSite[][] = [];
  for (let i = 0; i < rest.length; i += CONT_PER_SHEET) restSheets.push(rest.slice(i, i + CONT_PER_SHEET));

  return (
    <>
      <ReportPage r={r} ctx={ctx} section={section}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 11px", borderRadius: 99, background: "#DCFCE7", color: "#15803D" }}>What to do</span>
          <h1 style={text.h1}>Where AI looks, and how to get in front of it</h1>
        </div>
        <p style={text.take}>{takeLine(r)}</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 18, alignItems: "stretch" }}>
          <div style={{ border: "1px solid #E2E8F0", borderRadius: 18, padding: "16px 18px", display: "flex", gap: 20, alignItems: "center" }}>
            <div style={{ position: "relative", width: 150, height: 150, flexShrink: 0 }}>
              <div style={{ width: 150, height: 150, borderRadius: 75, background: donut }} />
              <div style={{ position: "absolute", left: 34, top: 34, width: 82, height: 82, borderRadius: 41, background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: ownColor }}>{own}%</span>
                <span style={{ fontSize: 10, color: "#64748B", textAlign: "center", lineHeight: 1.2 }}>your<br />website</span>
              </div>
            </div>
            <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {types.map((t) => {
                const me = t.type === "own_website";
                return (
                  <div key={t.type} style={{ display: "grid", gridTemplateColumns: "12px 1fr 40px", gap: 8, alignItems: "center" }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: sourceColor[t.type] }} />
                    <span style={{ fontSize: 13, fontWeight: me ? 800 : 600, color: me ? "#1D4ED8" : "#0F172A" }}>{sourceLabel[t.type]}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, textAlign: "right" }}>{t.pct}%</span>
                  </div>
                );
              })}
              {types.length === 0 && <span style={text.small}>No sources were cited in these answers.</span>}
            </div>
          </div>
          <div style={{ background: "#F8FAFC", borderRadius: 18, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={text.label}>Words AI added to its searches</span>
            {words.length > 0 ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {words.map((w, i) => (
                    <span key={w} style={{ padding: "7px 12px", borderRadius: 99, background: WORD_COLORS[i % WORD_COLORS.length], color: "#FFFFFF", fontSize: Math.max(12, 17 - i * 1.5), fontWeight: 800 }}>{w}</span>
                  ))}
                </div>
                <span style={{ ...text.small, color: "#475569" }}>AI added these words before naming anyone. Pages that answer them are the ones it cites.</span>
              </>
            ) : (
              <span style={{ ...text.small, color: "#475569" }}>No searches recorded. The assistants answered from what they already knew.</span>
            )}
          </div>
        </div>

        <div style={{ border: "2px solid #7C3AED", borderRadius: 18, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <OutreachHeader />
          {first.length > 0 ? <OutreachGrid sites={first} /> : (
            <EmptyState>No competitor-only sources found. When competitors won, AI cited the same sites it cites for you.</EmptyState>
          )}
        </div>

        <div style={{ flexGrow: 1 }} />

        <div style={{ marginBottom: 18, background: "#2563EB", borderRadius: 20, padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 380 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 26, lineHeight: 1.2, color: "#FFFFFF" }}>Get named more often.</span>
            <span style={{ fontSize: 14, lineHeight: 1.5, color: "#DBEAFE" }}>Mirror gets you onto the sites AI reads and builds the pages it searches for. We re-check in 90 days.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <a href={r.contact.bookingUrl} style={{ display: "inline-flex", alignItems: "center", minHeight: 46, padding: "0 22px", borderRadius: 12, background: "#FFFFFF", color: "#1D4ED8", fontSize: 15, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}>Book your kickoff →</a>
            <span style={{ fontSize: 12, color: "#DBEAFE" }}>{[r.contact.name, r.contact.email].filter(Boolean).join(" · ")}</span>
          </div>
        </div>
      </ReportPage>
      <SeeAll hiddenCount={rest.length} noun="outreach sites">
        {restSheets.map((sites, i) => (
          <ReportPage key={i} r={r} ctx={ctx} section={section} continued>
            <div style={{ border: "2px solid #7C3AED", borderRadius: 18, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              <OutreachHeader />
              <OutreachGrid sites={sites} />
            </div>
          </ReportPage>
        ))}
      </SeeAll>
    </>
  );
}
