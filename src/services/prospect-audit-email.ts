import type { Db } from "@/db";
import { loadEnv } from "@/lib/env";
import { escapeHtml } from "@/lib/html";
import { buildAuditReportData } from "@/report/build-report";
import { actionsFor, sortedTools } from "@/report/scoring";
import { toolMeta } from "@/report/tokens";
import type { AuditReport } from "@/report/types";
import { joinNames } from "@/report/pages/one-page-summary";
import { renderReportPdf } from "@/services/report-pdf";

/**
 * The email a prospect gets when their first scan finishes: a plain summary
 * of how AI treats them next to their top competitor, the proof in AI's own
 * words, the one-page summary attached as a PDF, and a request to book the
 * call where their fact sheet is set up. No fact claims: those facts were
 * read off their website by AI and nobody has reviewed them yet.
 */

/** "Dr. Kim Lee" → "Dr. Kim"; "Kim Lee" → "Kim". */
function firstName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return /^(dr|mr|mrs|ms|mx)\.?$/i.test(parts[0]) && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0] || "there";
}

/** One plain paragraph: what we asked, how often they came up, and against whom. */
export function summaryParagraph(r: AuditReport): string {
  const answers = r.scan.buyerQuestionCount * r.scan.runsPerQuestion * r.scan.tools.length;
  const named = r.leaderboard.find(e => e.isClient)?.count ?? 0;
  const tools = joinNames(r.scan.tools.map(t => toolMeta[t].name));
  const example = r.missedQuote?.question ?? r.questions[0]?.text;
  const sorted = sortedTools(r.toolResults);
  const best = sorted.find(t => t.isBest && t.named > 0);
  const silent = sorted.filter(t => t.named === 0).map(t => toolMeta[t.tool].name);
  const parts = [
    `We asked ${tools} the ${r.scan.buyerQuestionCount} questions your customers ask${example ? `, like "${example}"` : ""}.`,
    `You came up in ${named} of ${answers} answers. ${r.topCompetitor.name} came up in ${r.topCompetitor.namedCount}.`,
  ];
  if (best) parts.push(`${toolMeta[best.tool].name} mentioned you most${silent.length ? `; ${joinNames(silent)} never did` : ""}.`);
  else if (silent.length === sorted.length && sorted.length) parts.push("None of them mentioned you yet.");
  return parts.join(" ");
}

export function composeProspectReportEmail(r: AuditReport, opts: { contactName: string; appName: string }): { subject: string; html: string } {
  const e = escapeHtml;
  const category = r.business.category.toLowerCase();
  const city = r.business.location.split(",")[0];
  const named = r.leaderboard.find(l => l.isClient)?.count ?? 0;
  const losing = r.topCompetitor.namedCount > named;
  const subject = losing
    ? `When people ask AI for a ${category} in ${city}, they're sent to ${r.topCompetitor.name}`
    : `How AI answers when people look for a ${category} like ${r.business.name}`;
  const fixes = actionsFor("visibility", r).slice(0, 3);
  const q = r.missedQuote;
  const p = (html: string, style = "") =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1d1d1f;${style}">${html}</p>`;

  const html =
    `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;">` +
    `<div style="max-width:580px;margin:0 auto;background:#fff;border-radius:18px;padding:32px;">` +
    p(`Hi ${e(firstName(opts.contactName))},`) +
    p(e(summaryParagraph(r))) +
    (q
      ? `<div style="background:#f5f5f7;border-radius:14px;padding:16px 18px;margin:0 0 16px;">` +
        `<div style="font-size:13px;color:#6e6e73;margin-bottom:6px;">We asked ${e(toolMeta[q.tool].name)}: "${e(q.question)}"</div>` +
        `<div style="font-size:16px;line-height:1.5;color:#1d1d1f;font-style:italic;">"${e(q.text)}"</div>` +
        `<div style="font-size:14px;font-weight:600;color:#c4161c;margin-top:8px;">${e(r.business.name)} wasn't mentioned.</div></div>`
      : "") +
    p("<strong>Why this matters:</strong> more people now ask an AI assistant instead of searching Google. If it doesn't name you, those customers never see you.") +
    (fixes.length
      ? p("<strong>The good news: this is fixable.</strong> The changes that would help most:", "margin-bottom:8px;") +
        `<ol style="margin:0 0 16px;padding-left:22px;font-size:16px;line-height:1.5;color:#1d1d1f;">` +
        fixes.map(f => `<li style="margin-bottom:6px;"><strong>${e(f.title)}.</strong> ${e(f.why)}</li>`).join("") + `</ol>`
      : "") +
    p("Your one-page report is attached. It shows how you compare and what to change first.") +
    p("We also checked what AI says about your prices, services and hours. Before we show you, we'd like to set up your fact sheet with you, so we're checking AI against the truth, not a guess. It takes about 30 minutes.") +
    (r.contact.bookingUrl
      ? `<div style="margin:8px 0 20px;"><a href="${e(r.contact.bookingUrl)}" style="display:inline-block;background:#0071e3;color:#fff;border-radius:999px;padding:12px 22px;font-size:16px;font-weight:600;text-decoration:none;">Book a call to set up your fact sheet</a></div>`
      : "") +
    p(`${e(r.contact.name)}${r.contact.email ? `<br><span style="color:#6e6e73;">${e(r.contact.email)}</span>` : ""}`, "margin:0;") +
    `</div><div style="max-width:580px;margin:12px auto 0;font-size:12px;color:#86868b;text-align:center;">${e(opts.appName)} · AI search audit for ${e(r.business.name)}</div>` +
    `</body></html>`;
  return { subject, html };
}

export interface ReportEmail {
  to: string; from: string; subject: string; html: string; replyTo?: string;
  attachments: { filename: string; content: Buffer }[];
}
export type ReportEmailTransport = (email: ReportEmail) => Promise<void>;

const defaultTransport: ReportEmailTransport = async ({ to, from, subject, html, replyTo, attachments }) => {
  const { Resend } = await import("resend");
  const { error } = await new Resend(loadEnv().RESEND_API_KEY).emails.send({ from, to, subject, html, replyTo, attachments });
  if (error) throw new Error(`resend: ${error.message}`);
};

/**
 * Sends the prospect their report email. The PDF is a bonus: if it can't be
 * made (no browser available), the email still goes, without the attachment.
 */
export async function sendProspectReport(args: {
  report: () => Promise<AuditReport | null>;
  to: string;
  contactName: string;
  transport?: ReportEmailTransport;
  pdf?: (r: AuditReport) => Promise<Buffer>;
}): Promise<void> {
  const env = loadEnv();
  const report = await args.report();
  if (!report) throw new Error("no finished scan to send");
  const { subject, html } = composeProspectReportEmail(report, { contactName: args.contactName, appName: env.NEXT_PUBLIC_APP_NAME });
  const makePdf = args.pdf ?? (r => renderReportPdf(r, "summary"));
  const pdf = await makePdf(report).catch(err => { console.error("summary PDF failed:", err); return null; });
  const slug = report.business.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  await (args.transport ?? defaultTransport)({
    to: args.to, from: env.EMAIL_FROM, subject, html, replyTo: env.LEADS_EMAIL ?? env.OPERATOR_EMAIL,
    attachments: pdf ? [{ filename: `${slug}-ai-summary.pdf`, content: pdf }] : [],
  });
}

/** The real thing: the prospect's report from the database, emailed with its PDF. */
export function sendProspectReportFor(db: Db, practiceId: string, lead: { email: string; contactName: string }): Promise<void> {
  return sendProspectReport({ report: () => buildAuditReportData(db, practiceId), to: lead.email, contactName: lead.contactName });
}
