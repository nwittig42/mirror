import type { ReactNode } from "react";
import type { AuditReport, CitedSite, OutreachSite, SourceType } from "@/report/types";
import {
  Donut, NoteBox, ReportPage, StagePill, Takeaway, nn, text, type PageCtx, type PageProps,
} from "@/report/components";
import { SeeAll } from "@/report/see-all";
import { bandColors, conicDonut, headlines, rateBand, ringDash, sourceSlices } from "@/report/scoring";
import { color, sourceColor, sourceLabel } from "@/report/tokens";

/** Page 06: source-type donut, own-site ring, most-cited sites, outreach list (P06-Sources). */

const SITES_ON_SHEET = 6;
const OUTREACH_ON_SHEET = 5;
const SITES_PER_CONTINUATION = 16;
const OUTREACH_PER_CONTINUATION = 12;

/** Names used inside the takeaway sentence. */
const TAKE_NAME: Record<SourceType, string> = {
  articles: "articles",
  reviews_directories: "review sites",
  reddit_social: "Reddit and social posts",
  own_website: "your website",
  google: "Google",
  reference: "reference sites",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "4–6 of 9", or "4 of 4" for a single item. */
const span = (start: number, count: number, total: number) =>
  count > 1 ? `${start + 1}–${start + count} of ${total}` : `${start + 1} of ${total}`;

function section(ctx: PageCtx) {
  return `${nn(ctx.index)} · Where AI gets its answers`;
}

function sourcesTake(r: AuditReport) {
  const others = r.sources.types.filter((t) => t.type !== "own_website" && t.pct > 0).sort((a, b) => b.pct - a.pct);
  if (!others.length) return headlines(r).sources;
  const own = r.sources.types.find((t) => t.type === "own_website")?.pct ?? 0;
  const top = others.slice(0, 2);
  const share = top.reduce((s, t) => s + t.pct, 0);
  const names = top.map((t) => TAKE_NAME[t.type]).join(" and ");
  const first = `${cap(names)} shape ${share >= 50 ? "most" : "much"} of what AI says.`;
  return `${first} Your own website, ${own < 20 ? "just " : ""}${own}%.`;
}

function SiteRow({ s, rank }: { s: CitedSite; rank: number }) {
  const me = s.type === "own_website";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 10, background: color.panel }}>
      <span style={{ width: 22, height: 22, borderRadius: 11, background: color.ink, color: "#FFFFFF", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{rank}</span>
      <span style={{ flexGrow: 1, minWidth: 0, overflowWrap: "anywhere", fontSize: 13.5, fontWeight: me ? 800 : 600, color: me ? color.clientText : color.ink }}>{s.domain}</span>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: sourceColor[s.type], flexShrink: 0 }} />
    </div>
  );
}

function OutreachRow({ o, n }: { o: OutreachSite; n: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "24px 128px 1fr", gap: 10, alignItems: "start" }}>
      <span style={{ width: 22, height: 22, borderRadius: 6, background: "#EDE9FE", color: "#6D28D9", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
      <span style={{ fontSize: 13.5, fontWeight: 800, paddingTop: 2, minWidth: 0, overflowWrap: "anywhere" }}>{o.domain}</span>
      <span style={{ fontSize: 12.5, lineHeight: 1.4, color: color.text2, paddingTop: 2 }}>{o.ask}</span>
    </div>
  );
}

function OutreachBox({ take, children }: { take: string; children: ReactNode }) {
  return (
    <div style={{ border: "2px solid #7C3AED", borderRadius: 18, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="#7C3AED" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ ...text.label, color: "#6D28D9" }}>Your outreach list</span>
          <span style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>{take}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

export function SourcesPage({ r, ctx }: PageProps) {
  const s = r.sources;
  const h = headlines(r);
  const types = s.types.filter((t) => t.pct > 0);
  const donut = types.length ? conicDonut(sourceSlices(types)) : color.track;
  const own = s.ownSiteCitedPct;
  const ownC = bandColors(rateBand(own));

  const sites = s.topSites.slice(0, SITES_ON_SHEET);
  const sitesRest = s.topSites.slice(SITES_ON_SHEET);
  const outreach = s.competitorWinSites.slice(0, OUTREACH_ON_SHEET);
  const outreachRest = s.competitorWinSites.slice(OUTREACH_ON_SHEET);
  const hidden = sitesRest.length + outreachRest.length;
  const sheets = Math.max(
    Math.ceil(sitesRest.length / SITES_PER_CONTINUATION),
    Math.ceil(outreachRest.length / OUTREACH_PER_CONTINUATION),
  );

  return (
    <>
      <ReportPage r={r} ctx={ctx} section={section(ctx)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <StagePill stage="losing">Why they’re winning</StagePill>
          <h1 style={text.h1}>Where AI gets its answers</h1>
        </div>
        <Takeaway>{sourcesTake(r)}</Takeaway>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 190px", gap: 20, alignItems: "stretch" }}>
          <div style={{ border: `1px solid ${color.rule}`, borderRadius: 18, padding: "18px 20px", display: "flex", gap: 24, alignItems: "center" }}>
            <Donut background={donut} size={176} hole={96}>
              <span style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.2 }}>Sources<br />AI cited</span>
            </Donut>
            <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 7 }}>
              {types.length ? types.map((t) => {
                const me = t.type === "own_website";
                return (
                  <div key={t.type} style={{ display: "grid", gridTemplateColumns: "14px 1fr 44px", gap: 10, alignItems: "center" }}>
                    <span style={{ width: 14, height: 14, borderRadius: 4, background: sourceColor[t.type] }} />
                    <span style={{ fontSize: 13.5, fontWeight: me ? 800 : 600, color: me ? color.clientText : color.ink }}>{sourceLabel[t.type]}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, textAlign: "right" }}>{t.pct}%</span>
                  </div>
                );
              }) : <span style={text.small}>No sources were cited in this scan.</span>}
            </div>
          </div>
          <div style={{ background: ownC.soft, borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
            <span style={{ ...text.label, color: ownC.text }}>Your own website</span>
            <div style={{ position: "relative", width: 104, height: 104 }}>
              <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true">
                <circle cx="52" cy="52" r="42" fill="none" stroke="#FFFFFF" strokeWidth="12" />
                <circle cx="52" cy="52" r="42" fill="none" stroke={ownC.fill} strokeWidth="12" transform="rotate(-90 52 52)" style={{ strokeDasharray: ringDash(own, 42) }} />
              </svg>
              <div style={{ position: "absolute", left: 0, top: 0, width: 104, height: 104, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800 }}>{own}%</div>
            </div>
            <span style={{ fontSize: 12.5, lineHeight: 1.4, overflowWrap: "anywhere" }}>of answers cited {r.business.website}</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 20, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <span style={text.label}>Most-cited sites</span>
            {sites.length ? (
              <>
                {sites.map((x, i) => <SiteRow key={x.domain + i} s={x} rank={i + 1} />)}
                <span style={text.small}>Square = type of site, colors as in the chart above.</span>
              </>
            ) : (
              <div style={{ border: `2px dashed ${color.competitor}`, borderRadius: 12, padding: 14, ...text.small }}>No sites were cited in this scan.</div>
            )}
          </div>

          <OutreachBox take={h.outreach}>
            {outreach.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {outreach.map((o, i) => <OutreachRow key={o.domain + i} o={o} n={i + 1} />)}
              </div>
            ) : (
              <div style={{ border: `2px dashed ${color.competitor}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>No competitor-only sources found</span>
                <span style={text.small}>When competitors won, AI cited the same sites it cites for you. Your gap is on your own pages.</span>
              </div>
            )}
          </OutreachBox>
        </div>

        <NoteBox>
          <p style={{ margin: 0 }}>AI trusts what other sites say about you more than what you say about yourself. Being on the right lists and review sites, with correct details, matters as much as your own website.</p>
        </NoteBox>
      </ReportPage>

      <SeeAll hiddenCount={hidden} noun="sites">
        {Array.from({ length: sheets }, (_, ci) => {
          const siteStart = SITES_ON_SHEET + ci * SITES_PER_CONTINUATION;
          const outStart = OUTREACH_ON_SHEET + ci * OUTREACH_PER_CONTINUATION;
          const siteChunk = sitesRest.slice(ci * SITES_PER_CONTINUATION, (ci + 1) * SITES_PER_CONTINUATION);
          const outChunk = outreachRest.slice(ci * OUTREACH_PER_CONTINUATION, (ci + 1) * OUTREACH_PER_CONTINUATION);
          return (
            <ReportPage key={ci} r={r} ctx={ctx} section={section(ctx)} continued>
              <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 20, alignItems: "start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                  {siteChunk.length > 0 && (
                    <>
                      <span style={text.label}>Most-cited sites, continued</span>
                      {siteChunk.map((x, i) => <SiteRow key={x.domain + i} s={x} rank={siteStart + i + 1} />)}
                    </>
                  )}
                </div>
                {outChunk.length > 0 && (
                  <OutreachBox take={`Sites ${span(outStart, outChunk.length, s.competitorWinSites.length)}`}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {outChunk.map((o, i) => <OutreachRow key={o.domain + i} o={o} n={outStart + i + 1} />)}
                    </div>
                  </OutreachBox>
                )}
              </div>
            </ReportPage>
          );
        })}
      </SeeAll>
    </>
  );
}
