import type { ReactNode } from "react";
import { EmptyState, NoteBox, ReportPage, StagePill, Takeaway, nn, text, type PageProps } from "@/report/components";
import { conicDonut, headlines, sortedChecks } from "@/report/scoring";
import { color, statusColor } from "@/report/tokens";
import type { CheckStatus, WebsiteCheck } from "@/report/types";

const STATUS: Record<CheckStatus, { status: string; iconBg: string; soft: string }> = {
  pass: { status: "Pass", iconBg: statusColor.good.fill, soft: statusColor.good.soft },
  warn: { status: "Check", iconBg: statusColor.warn.strong, soft: statusColor.warn.soft },
  fail: { status: "Fail", iconBg: statusColor.bad.fill, soft: statusColor.bad.soft },
};

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const numberWord = (n: number) => WORDS[n] ?? String(n);

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "pass") {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    );
  }
  if (status === "warn") {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" aria-hidden="true"><path d="M12 6v8" /><path d="M12 18.5v.5" /></svg>
    );
  }
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" aria-hidden="true"><path d="M7 7l10 10" /><path d="M17 7L7 17" /></svg>
  );
}

/** "What this means" copy, driven by which checks failed. */
function meaning(checks: WebsiteCheck[]): ReactNode {
  const bad = (id: string) => checks.some(c => c.id === id && c.status !== "pass");
  if (checks.every(c => c.status === "pass")) {
    return "AI can read your site and find your key facts on it. Keep your prices and hours current there, so AI has no reason to look elsewhere.";
  }
  if (bad("ai_allowed")) {
    return "Your site is keeping some AI assistants out, so they learn about you only from other sites, including out-of-date ones. Letting them in is the first fix.";
  }
  if (bad("facts_page") || bad("machine_labels")) {
    return "AI can read your site, but it can’t easily find your prices and key facts on it. So it grabs them from other sites, including out-of-date ones. A single facts page fixes most of this.";
  }
  return "AI can read your site and find your key facts, but a few things make that harder than it should be. Each fix below is small.";
}

export function WebsitePage({ r, ctx }: PageProps) {
  const raw = r.websiteChecks;
  const checks = sortedChecks(raw);
  const n = (s: CheckStatus) => raw.filter(c => c.status === s).length;
  const passed = n("pass");
  const total = raw.length;
  const tally = [
    { name: "passed", n: passed, bg: STATUS.pass.iconBg },
    { name: "to check", n: n("warn"), bg: STATUS.warn.iconBg },
    { name: "failed", n: n("fail"), bg: STATUS.fail.iconBg },
  ];
  // Segmented ring: one slice per check, in pass/warn/fail order.
  const ring = total
    ? conicDonut((["pass", "warn", "fail"] as CheckStatus[]).flatMap(s => raw.filter(c => c.status === s).map(() => ({ value: 1, color: STATUS[s].iconBg }))), 1.2)
    : color.track;
  const take = !total
    ? "We couldn’t run the website checks this time."
    : n("fail") + n("warn") === 0
      ? headlines(r).website
      : `${headlines(r).website}${n("fail") ? " The failures make it hard for AI to find your prices and facts." : " The rest need a quick look."}`;

  return (
    <ReportPage r={r} ctx={ctx} section={`${nn(ctx.index)} · Website check`}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 250px", gap: 24, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <StagePill stage="fix" />
          <h1 style={text.h1}>Website check: is your site ready for AI?</h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: color.muted }}>
            We checked {r.business.website} for the {numberWord(total)} things AI assistants need to read your site and trust it.
          </p>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }} aria-hidden="true">
            <div style={{ width: 120, height: 120, borderRadius: 60, background: ring }} />
            <div style={{ position: "absolute", left: 22, top: 22, width: 76, height: 76, borderRadius: 38, background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{passed}/{total}</span>
              <span style={{ fontSize: 10, color: color.subtle }}>passed</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tally.map(t => (
              <span key={t.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
                <span style={{ width: 12, height: 12, borderRadius: 6, background: t.bg }} />{t.n} {t.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <Takeaway>{take}</Takeaway>

      {total ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {checks.map(c => {
            const s = STATUS[c.status];
            return (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "40px 1fr 92px", gap: 14, padding: "12px 16px", borderRadius: 16, background: s.soft, alignItems: "start" }}>
                <span style={{ width: 34, height: 34, borderRadius: 17, background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <StatusIcon status={c.status} />
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>{c.label}</span>
                  <span style={{ fontSize: 13, lineHeight: 1.45, color: color.text2 }}>{c.why}</span>
                  {c.status !== "pass" && c.fix && (
                    <span style={{ fontSize: 13, lineHeight: 1.45, color: color.ink }}><strong>Fix:</strong> {c.fix}</span>
                  )}
                </div>
                <span style={{ justifySelf: "end", fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", padding: "5px 12px", borderRadius: 99, background: s.iconBg, color: "#FFFFFF" }}>{s.status}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No website checks recorded">We’ll check your site on the next scan.</EmptyState>
      )}

      {total > 0 && <NoteBox>{meaning(raw)}</NoteBox>}
    </ReportPage>
  );
}
