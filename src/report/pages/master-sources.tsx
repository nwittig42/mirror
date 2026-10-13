import type { ReactNode } from "react";
import type { AuditReport, CitedSite, OutreachSite, SourceType } from "@/report/types";
import { Bar, NumberDot, PageTitle, ReportPage, StatusDot, card, clamp, text, type PageProps } from "@/report/components";
import { SeeAll } from "@/report/see-all";
import { headlines, sortedChecks } from "@/report/scoring";
import { color, sourceLabel } from "@/report/tokens";

const SITES_ON_SHEET = 6;
const OUTREACH_ON_SHEET = 5;
const CHECKS_ON_SHEET = 4;
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

/** "4 to 6 of 9", or "4 of 4" for a single item. */
const span = (start: number, count: number, total: number) =>
  count > 1 ? `${start + 1} to ${start + count} of ${total}` : `${start + 1} of ${total}`;

const SECTION = "The sites AI relies on";

function sourcesTake(r: AuditReport) {
  const others = r.sources.types.filter((t) => t.type !== "own_website" && t.pct > 0).sort((a, b) => b.pct - a.pct);
  const own = r.sources.types.find((t) => t.type === "own_website")?.pct ?? 0;
  if (!others.length) return `Your own website is ${own}% of what AI read.`;
  const top = others.slice(0, 2);
  const share = top.reduce((s, t) => s + t.pct, 0);
  const names = top.map((t) => TAKE_NAME[t.type]).join(" and ");
  return `${cap(names)} shape ${share >= 50 ? "most" : "much"} of what AI says. Your own website is ${own < 20 ? "just " : ""}${own}% of what it read.`;
}

function SiteRow({ s, rank }: { s: CitedSite; rank: number }) {
  const me = s.type === "own_website";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "20px 1fr auto", alignItems: "baseline", gap: 8, padding: "6px 0", borderBottom: `1px solid ${color.rule}` }}>
      <span style={{ fontSize: 12, color: color.muted }}>{rank}</span>
      <span style={{ minWidth: 0, overflowWrap: "anywhere", fontSize: 13.5, fontWeight: 600, color: me ? color.clientText : color.ink }}>{s.domain}</span>
      <span style={{ fontSize: 11.5, color: me ? color.clientText : color.muted, whiteSpace: "nowrap" }}>{sourceLabel[s.type]}</span>
    </div>
  );
}

function OutreachRow({ o, n }: { o: OutreachSite; n: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "22px 1fr", gap: 10, alignItems: "start" }}>
      <NumberDot n={n} tone="gold" size={20} />
      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, overflowWrap: "anywhere" }}>{o.domain}</span>
        <span style={{ fontSize: 12.5, lineHeight: 1.4, color: color.body, ...clamp(2) }}>{o.ask}</span>
      </div>
    </div>
  );
}

function OutreachBox({ take, children }: { take: string; children: ReactNode }) {
  return (
    <div style={{ ...card, padding: "14px 18px", borderColor: color.client, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ ...text.label, color: color.clientText }}>Where competitors win</span>
        <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, ...clamp(2) }}>{take}</span>
      </div>
      {children}
    </div>
  );
}

/** Page 5 of the full report: what kinds of sites AI reads, the top sites, where competitors win, and whether AI can read your own site. */
export function SourcesPage({ r, ctx }: PageProps) {
  const s = r.sources;
  const types = s.types.filter((t) => t.pct > 0).sort((a, b) => b.pct - a.pct);
  const maxPct = Math.max(1, ...types.map((t) => t.pct));
  const own = s.ownSiteCitedPct;

  const sites = s.topSites.slice(0, SITES_ON_SHEET);
  const sitesRest = s.topSites.slice(SITES_ON_SHEET);
  const outreach = s.competitorWinSites.slice(0, OUTREACH_ON_SHEET);
  const outreachRest = s.competitorWinSites.slice(OUTREACH_ON_SHEET);
  const hidden = sitesRest.length + outreachRest.length;
  const sheets = Math.max(
    Math.ceil(sitesRest.length / SITES_PER_CONTINUATION),
    Math.ceil(outreachRest.length / OUTREACH_PER_CONTINUATION),
  );

  const ov = r.aiOverviews;
  const checks = sortedChecks(r.websiteChecks);
  const passed = checks.filter((c) => c.status === "pass").length;
  const open = checks.filter((c) => c.status !== "pass");
  const openShown = open.slice(0, CHECKS_ON_SHEET);

  return (
    <>
      <ReportPage r={r} ctx={ctx} section={SECTION} gap={14}>
        <PageTitle eyebrow="Why they win" title="The sites AI relies on">{sourcesTake(r)}</PageTitle>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 190px", gap: 12, alignItems: "stretch" }}>
          <div style={{ ...card, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 7 }}>
            <span style={text.label}>What AI read, by kind of site</span>
            {types.length ? types.map((t) => {
              const me = t.type === "own_website";
              return (
                <div key={t.type} style={{ display: "grid", gridTemplateColumns: "170px 1fr 40px", gap: 10, alignItems: "center", fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: me ? color.clientText : color.ink }}>{sourceLabel[t.type]}</span>
                  <Bar pct={(t.pct / maxPct) * 100} fill={me ? color.client : color.competitor} height={10} track={color.panel} />
                  <span style={{ fontWeight: 600, textAlign: "right", color: me ? color.clientText : color.ink }}>{t.pct}%</span>
                </div>
              );
            }) : <span style={text.small}>AI did not show its sources in this scan.</span>}
          </div>
          <div style={{ ...card, background: color.panel, borderColor: color.panel, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
            <span style={text.label}>Your own website</span>
            <span style={{ ...text.stat, fontSize: 44, color: color.clientText }}>{own}%</span>
            <span style={{ fontSize: 12.5, lineHeight: 1.4, color: color.body, overflowWrap: "anywhere" }}>of answers pointed to {r.business.website || "your website"}.</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: 20, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ ...text.label, paddingBottom: 4 }}>The sites AI read most</span>
            {sites.length
              ? sites.map((x, i) => <SiteRow key={x.domain + i} s={x} rank={i + 1} />)
              : <span style={{ ...text.small, paddingTop: 6 }}>AI did not show its sources in this scan.</span>}
          </div>

          <OutreachBox take={headlines(r).outreach}>
            {outreach.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {outreach.map((o, i) => <OutreachRow key={o.domain + i} o={o} n={i + 1} />)}
              </div>
            ) : (
              <span style={text.small}>When competitors won, AI read the same sites it reads for you. The gap is on your own pages.</span>
            )}
          </OutreachBox>
        </div>

        {checks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={text.label}>Can AI read your own website? {passed} of {checks.length} checks passed{open.length ? ". Not yet:" : ""}</span>
            {open.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", columnGap: 20, rowGap: 6 }}>
                {openShown.map((c) => (
                  <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, lineHeight: 1.35, color: color.ink, minWidth: 0 }}>
                    <StatusDot status={c.status === "fail" ? "bad" : "warn"} size={16} />
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
                  </div>
                ))}
                {open.length > openShown.length && <span style={text.small}>And {open.length - openShown.length} more.</span>}
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: color.ink }}>
                <StatusDot status="good" size={16} />AI can read your site and find your key facts on it.
              </div>
            )}
          </div>
        )}

        <p style={{ ...text.small, margin: "auto 0 0", paddingBottom: 6 }}>
          {ov && ov.asked > 0 && (
            <strong style={{ fontWeight: 600, color: color.ink }}>
              Google showed an AI Overview for {ov.shown} of {ov.asked} customer {ov.asked === 1 ? "question" : "questions"}
              {ov.shown > 0 ? ` and named you in ${ov.namedIn}. ` : ". "}
            </strong>
          )}
          AI trusts what other sites say about you more than what you say about yourself. Being on the right lists and review sites, with correct details, matters as much as your own website.
        </p>
      </ReportPage>

      <SeeAll hiddenCount={hidden} noun="sites">
        {Array.from({ length: sheets }, (_, ci) => {
          const siteStart = SITES_ON_SHEET + ci * SITES_PER_CONTINUATION;
          const outStart = OUTREACH_ON_SHEET + ci * OUTREACH_PER_CONTINUATION;
          const siteChunk = sitesRest.slice(ci * SITES_PER_CONTINUATION, (ci + 1) * SITES_PER_CONTINUATION);
          const outChunk = outreachRest.slice(ci * OUTREACH_PER_CONTINUATION, (ci + 1) * OUTREACH_PER_CONTINUATION);
          return (
            <ReportPage key={ci} r={r} ctx={ctx} section={SECTION} continued>
              <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: 20, alignItems: "start" }}>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  {siteChunk.length > 0 && (
                    <>
                      <span style={{ ...text.label, paddingBottom: 4 }}>The sites AI read most, continued</span>
                      {siteChunk.map((x, i) => <SiteRow key={x.domain + i} s={x} rank={siteStart + i + 1} />)}
                    </>
                  )}
                </div>
                {outChunk.length > 0 && (
                  <OutreachBox take={`Sites ${span(outStart, outChunk.length, s.competitorWinSites.length)}`}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
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
