import type { Db } from "@/db";
import { loadEnv } from "@/lib/env";
import { escapeHtml } from "@/lib/html";
import { buildAuditReportData } from "@/report/build-report";
import { actionsFor, sortedTools } from "@/report/scoring";
import { toolMeta } from "@/report/tokens";
import type { AuditReport } from "@/report/types";
import { joinNames } from "@/report/pages/one-page-summary";
import { renderReportPdf } from "@/services/report-pdf";
import { eq } from "drizzle-orm";
import { practiceMembers, users } from "@/db/schema";
import { createInvite } from "@/services/account-invites";
import {
  EMAIL_COLORS, emailButton, emailLabel, emailLink, emailNote, emailQuote, emailRule, emailShell, emailText,
} from "@/services/email-shell";

/**
 * The email a prospect gets when their first scan finishes: a plain summary
 * of how AI treats them next to their top competitor, the proof in AI's own
 * words, the one-page summary attached as a PDF, and a request to book the
 * call where their fact sheet is set up. No fact claims: those facts were
 * read off their website by AI and nobody has reviewed them yet.
 *
 * It also carries their set-up link. The dashboard it opens shows the summary and
 * names what the call unlocks, so the email and the dashboard ask for the
 * same next step.
 */

/**
 * How the prospect gets into their dashboard. `setupUrl` is the link where
 * they choose a password; it is null when they already have one, and the
 * email then points them to `loginUrl`.
 */
export interface ProspectLogin { email: string; setupUrl: string | null; loginUrl: string }

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

export function composeProspectReportEmail(
  r: AuditReport, opts: { contactName: string; appName: string; login?: ProspectLogin | null },
): { subject: string; html: string } {
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
  const login = opts.login;

  // The quote is a competitor being recommended, never a claim about the
  // prospect's own facts.
  const quoteBlock = q
    ? emailQuote(`&ldquo;${e(q.text)}&rdquo;`, `We asked ${e(toolMeta[q.tool].name)}: &ldquo;${e(q.question)}&rdquo;`) +
      `<div style="padding-top:10px;">${emailText(`<strong>${e(r.business.name)} wasn't mentioned.</strong>`, "bad", 14)}</div>`
    : "";

  const fixesBlock = fixes.length
    ? emailLabel("What would help most") +
      emailText("This is fixable. The changes that would help most:") +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
      fixes.map((f, i) =>
        `<tr><td width="26" valign="top" style="padding-top:10px;">${emailText(`<strong>${i + 1}.</strong>`, "gold")}</td>` +
        `<td valign="top" style="padding-top:10px;">${emailText(`<strong>${e(f.title)}.</strong> ${e(f.why)}`)}</td></tr>`).join("") +
      `</table>`
    : "";

  const loginBlock = login
    ? emailRule() +
      `<div style="padding-top:22px;">` +
      emailLabel("Your account") +
      emailText(login.setupUrl
        ? "<strong>Choose a password to see your full audit.</strong>"
        : `<strong>Log in with ${e(login.email)} to see your full audit.</strong>`) +
      emailText("It shows how often AI recommends you and this summary today. Your Accuracy score, every AI answer and your fix plan open after your call.", "secondary", 14) +
      `</div><div style="padding-top:12px;">${login.setupUrl ? emailButton(login.setupUrl, "Set up your account") : emailButton(login.loginUrl, "Log in")}</div>`
    : "";

  const html = emailShell({
    brand: opts.appName,
    blocks: [
      emailText(`Hi ${e(firstName(opts.contactName))},`),
      emailText(e(summaryParagraph(r))),
      quoteBlock,
      emailLabel("Why this matters") +
        emailText("More people now ask AI instead of searching Google. If AI doesn't name you, those customers never see you."),
      fixesBlock,
      emailText("Your one-page report is attached. It shows how you compare and what to change first."),
      emailText("We also checked what AI says about your prices, services and hours. Before we show you, we'd like to set up your fact sheet with you, so we check AI against the truth and not a guess. The call takes about 30 minutes."),
      r.contact.bookingUrl ? emailButton(r.contact.bookingUrl, "Book a call to set up your fact sheet") : "",
      loginBlock,
      emailText(`${e(r.contact.name)}${r.contact.email ? `<br><span style="font-size:14px;color:${EMAIL_COLORS.caption};">${e(r.contact.email)}</span>` : ""}`),
    ],
    footerHtml: `${e(opts.appName)} &middot; AI search audit for ${e(r.business.name)}`,
  });
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
  login?: ProspectLogin | null;
}): Promise<void> {
  const env = loadEnv();
  const report = await args.report();
  if (!report) throw new Error("no finished scan to send");
  const { subject, html } = composeProspectReportEmail(report, {
    contactName: args.contactName, appName: env.NEXT_PUBLIC_APP_NAME, login: args.login,
  });
  const makePdf = args.pdf ?? (r => renderReportPdf(r, "summary"));
  const pdf = await makePdf(report).catch(err => { console.error("summary PDF failed:", err); return null; });
  const slug = report.business.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  await (args.transport ?? defaultTransport)({
    to: args.to, from: env.EMAIL_FROM, subject, html, replyTo: env.LEADS_EMAIL ?? env.OPERATOR_EMAIL,
    attachments: pdf ? [{ filename: `${slug}-ai-summary.pdf`, content: pdf }] : [],
  });
}

/**
 * The real thing: the prospect's report from the database, emailed with its
 * PDF and a link to set up their account. Someone who already has a password
 * keeps it and is linked to the business, with a plain log-in link instead.
 * If no link can be made (the address is the operator's, say), the report
 * still goes, without one.
 */
export async function sendProspectReportFor(
  db: Db, practiceId: string, lead: { email: string; contactName: string },
  transport?: ReportEmailTransport, pdf?: (r: AuditReport) => Promise<Buffer>,
): Promise<void> {
  const appUrl = loadEnv().APP_URL;
  const email = lead.email.trim().toLowerCase();
  const login = await (async (): Promise<ProspectLogin | null> => {
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing?.role === "operator") return null;
    if (existing?.passwordHash) {
      await db.insert(practiceMembers).values({ userId: existing.id, practiceId }).onConflictDoNothing();
      return { email, setupUrl: null, loginUrl: `${appUrl}/login` };
    }
    const token = await createInvite(db, practiceId, email);
    return { email, setupUrl: `${appUrl}/welcome?token=${token}`, loginUrl: `${appUrl}/login` };
  })().catch(err => {
    console.error(`no set-up link made for ${practiceId}:`, err);
    return null;
  });
  await sendProspectReport({
    report: () => buildAuditReportData(db, practiceId), to: lead.email, contactName: lead.contactName, login, transport, pdf,
  });
}
