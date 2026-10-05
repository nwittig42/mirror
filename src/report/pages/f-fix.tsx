import type { Action, CheckStatus, WebsiteCheck } from "@/report/types";
import { ReportPage, EmptyState, StatusDot, FONT_DISPLAY, text, nn, type PageProps } from "@/report/components";
import { actionsFor, effortColor, impactColor, levelLabel, sortedChecks, sortedWrongFacts } from "@/report/scoring";
import { color, statusColor } from "@/report/tokens";
import { SeeAll } from "@/report/see-all";
import { estLines, paginate } from "@/report/pages/f-true-false";

const CHECK: Record<CheckStatus, { label: string; dot: "good" | "warn" | "bad"; bg: string; soft: string }> = {
  pass: { label: "Pass", dot: "good", bg: statusColor.good.fill, soft: statusColor.good.soft },
  warn: { label: "Check", dot: "warn", bg: statusColor.warn.strong, soft: statusColor.warn.soft },
  fail: { label: "Fail", dot: "bad", bg: statusColor.bad.fill, soft: statusColor.bad.soft },
};

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const word = (n: number) => WORDS[n] ?? String(n);

/** Action "fixes" lines point at master-report pages ("(p. 08)"); those numbers are wrong in this 4-page report. */
const stripPageRefs = (s: string) => s.replace(/\s*\(p\.[^)]*\)/g, "").trim();

/* Height estimates (px) used to keep the sheet from overflowing. */
const CONTENT_H = 887;
function checkRowH(c: WebsiteCheck) {
  return 18 + Math.max(26, estLines(c.label, 14, 520, true) * 18.2 + 1 + estLines(c.why, 12, 520) * 17.4);
}
function actionCardH(a: Action) {
  return 24 + estLines(a.title, 14, 265, true) * 18.2 + 4 + estLines(`Fixes: ${stripPageRefs(a.fixes)}`, 12, 265) * 16.8 + 4 + 17;
}

function CheckRow({ c }: { c: WebsiteCheck }) {
  const s = CHECK[c.status];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "30px 1fr 74px", gap: 12, padding: "9px 12px", borderRadius: 12, background: s.soft, alignItems: "center" }}>
      <StatusDot status={s.dot} size={26} />
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 800 }}>{c.label}</span>
        <span style={{ ...text.small, color: color.text2 }}>{c.why}</span>
      </div>
      <span style={{ justifySelf: "end", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 99, background: s.bg, color: "#FFFFFF" }}>{s.label}</span>
    </div>
  );
}

function ActionCard({ a, n }: { a: Action; n: number }) {
  const e = effortColor(a.effort);
  const i = impactColor(a.impact);
  return (
    <div style={{ border: `1px solid ${color.rule}`, borderRadius: 14, padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 10, background: statusColor.good.fill, color: "#FFFFFF", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3 }}>{a.title}</span>
        <span style={{ fontSize: 12, lineHeight: 1.4, color: color.text2 }}>Fixes: {stripPageRefs(a.fixes)}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: e.tint, color: e.text }}>{levelLabel[a.effort]} effort</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: i.tint, color: i.text }}>{levelLabel[a.impact]} impact</span>
        </div>
      </div>
    </div>
  );
}

function ActionGrid({ items, start }: { items: Action[]; start: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
      {items.map((a, k) => <ActionCard key={a.id} a={a} n={start + k + 1} />)}
    </div>
  );
}

export function FFixPage({ r, ctx }: PageProps) {
  const section = `${nn(ctx.index)} · How to fix it`;
  const checks = sortedChecks(r.websiteChecks);
  const passed = checks.filter((c) => c.status === "pass").length;
  const actions = actionsFor("factcheck", r);
  const wrongCount = sortedWrongFacts(r.facts).length;
  const low = actions.filter((a) => a.effort === "low").length;

  const lowLine = low === 0
    ? "Start at the top: the first fix matters most."
    : low === actions.length && actions.length > 1
      ? `All ${word(low).toLowerCase()} are low effort.`
      : `${word(low)} ${low === 1 ? "is" : "are"} low effort.`;
  const take = `${lowLine}${wrongCount ? ` Together they correct every false fact on page ${ctx.index - 1}.` : ""}`;

  // Budget: what's left for the fix-list grid after the fixed parts of the sheet.
  const titleH = 22 + 10 + 39;
  const checksH = checks.length ? 16 + checks.reduce((s, c) => s + 10 + checkRowH(c), 0) : 16 + 10 + 70;
  const listHeadH = 16 + 10 + estLines(take, 16, 688, true) * 22.4 + 10;
  const ctaH = 135;
  const gapsH = 18 * 5;
  const gridBudget = CONTENT_H - titleH - checksH - listHeadH - ctaH - gapsH;

  const rows: Action[][] = [];
  for (let k = 0; k < actions.length; k += 2) rows.push(actions.slice(k, k + 2));
  const rowH = (row: Action[]) => Math.max(...row.map(actionCardH));
  const sheets = paginate(rows, rowH, gridBudget, CONTENT_H - 40, 10, 0);
  const [firstRows = [], ...moreSheets] = sheets;
  const firstItems = firstRows.flat();
  const hiddenCount = moreSheets.flat(2).length;

  const contactLine = [r.contact.name, r.contact.email].filter(Boolean).join(" · ");

  return (
    <>
      <ReportPage r={r} ctx={ctx} section={section}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 11px", borderRadius: 99, background: "#DBEAFE", color: "#1D4ED8" }}>How to fix it</span>
          <h1 style={text.h1}>Give AI one correct place to read your facts</h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={text.label}>Your website check</span>
            {checks.length > 0 && <span style={{ fontSize: 13, fontWeight: 800 }}>{passed} of {checks.length} passed</span>}
          </div>
          {checks.length ? checks.map((c) => <CheckRow key={c.id} c={c} />) : (
            <EmptyState>We didn’t run a website check for this report.</EmptyState>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={text.label}>Fix list, in order</span>
          {actions.length ? (
            <>
              <p style={text.take}>{take}</p>
              <ActionGrid items={firstItems} start={0} />
            </>
          ) : (
            <EmptyState>No fact fixes needed right now. We’ll keep checking what AI says about you.</EmptyState>
          )}
        </div>

        <div style={{ flexGrow: 1 }} />

        <div style={{ background: color.client, borderRadius: 20, padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 380 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 26, lineHeight: 1.2, color: "#FFFFFF" }}>Mirror fixes the facts in month 1.</span>
            <span style={{ fontSize: 14, lineHeight: 1.5, color: "#DBEAFE" }}>A 20-minute call to confirm your prices, hours and services. Then we correct them everywhere AI reads.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
            <a href={r.contact.bookingUrl} style={{ display: "inline-flex", alignItems: "center", minHeight: 46, padding: "0 22px", borderRadius: 12, background: "#FFFFFF", color: "#1D4ED8", fontSize: 15, fontWeight: 800, textDecoration: "none" }}>Book your kickoff →</a>
            {contactLine && <span style={{ fontSize: 12, color: "#DBEAFE" }}>{contactLine}</span>}
          </div>
        </div>
        {/* Keeps the design's 18px space between the call to action and the footer rule. */}
        <div aria-hidden="true" />
      </ReportPage>

      <SeeAll hiddenCount={hiddenCount} noun="fixes">
        {moreSheets.map((rs, k) => {
          const start = firstItems.length + moreSheets.slice(0, k).flat(2).length;
          return (
            <ReportPage key={k} r={r} ctx={ctx} section={section} continued>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={text.label}>Fix list, in order (continued)</span>
                <ActionGrid items={rs.flat()} start={start} />
              </div>
            </ReportPage>
          );
        })}
      </SeeAll>
    </>
  );
}
