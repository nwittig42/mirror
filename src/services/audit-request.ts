import { z } from "zod";
import { escapeHtml } from "@/lib/html";
import { loadEnv } from "@/lib/env";
import { isSafeHttpUrl } from "@/lib/url";

/**
 * Inbound audit requests from the public /book form — the only path by which a
 * stranger can reach us. There is deliberately no database table: at current
 * volume the sales inbox is the CRM, and adding a table would mean an
 * unauthenticated write endpoint for no gain. If volume justifies one later,
 * this module is where it goes.
 */

/**
 * Owners type "harborplumbing.com", not "https://harborplumbing.com". Prefixing the
 * scheme before validating turns the common input into a pass rather than a
 * scolding, and anything that is not http(s) after prefixing still fails
 * `isSafeHttpUrl` — "javascript:alert(1)" becomes "https://javascript:alert(1)",
 * whose non-numeric port fails to parse.
 */
function withScheme(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export const auditRequestSchema = z.object({
  practiceName: z
    .string()
    .trim()
    .min(2, "Tell us the business name.")
    .max(120, "That's longer than we can store, so please abbreviate it."),
  websiteUrl: z
    .string()
    .trim()
    .min(1, "We need your website to run the scan before the call.")
    .max(300, "That URL is too long.")
    .transform(withScheme)
    .refine(isSafeHttpUrl, "That doesn't look like a website address."),
  // Both optional. When given they are authoritative over the question
  // drafter's guesses and feed the namesake guard, so a plumber in Portland
  // is not scored against answers about a plumber in Denver.
  category: z.string().trim().max(60, "Keep this under 60 characters."),
  location: z.string().trim().max(80, "Keep this under 80 characters."),
  contactName: z.string().trim().min(2, "Tell us your name.").max(80, "That name is too long."),
  email: z.string().trim().email("Check this email address.").max(200, "That email is too long."),
  phone: z.string().trim().max(40, "That phone number is too long."),
  bestTimes: z.string().trim().max(300, "Keep this under 300 characters."),
});

export type AuditRequest = z.infer<typeof auditRequestSchema>;

const row = (label: string, value: string): string =>
  `<tr>` +
  `<td style="padding:10px 16px 10px 0;border-bottom:1px solid #e5e5e5;font-family:sans-serif;font-size:13px;color:#666;white-space:nowrap;vertical-align:top;">${label}</td>` +
  `<td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-family:sans-serif;font-size:15px;color:#111;">${value}</td>` +
  `</tr>`;

/**
 * Pure composer for the internal "new audit request" notification. Kept pure
 * (no network, no env) so it is cheaply unit-testable; `sendAuditRequest` does
 * the I/O. Mirrors `composePulse` in pulse-email.ts.
 */
export function composeAuditRequest(req: AuditRequest): { subject: string; html: string } {
  const subject = `Audit request: ${req.practiceName}`;

  const rows = [
    row("Business", escapeHtml(req.practiceName)),
    row(
      "Website",
      `<a href="${escapeHtml(req.websiteUrl)}" style="color:#2563eb;">${escapeHtml(req.websiteUrl)}</a>`,
    ),
    // Kept next to the website so the operator reads what the business is
    // and where before who sent it.
    ...(req.category ? [row("Kind of business", escapeHtml(req.category))] : []),
    ...(req.location ? [row("City or area", escapeHtml(req.location))] : []),
    row("Contact", escapeHtml(req.contactName)),
    row("Email", `<a href="mailto:${escapeHtml(req.email)}" style="color:#2563eb;">${escapeHtml(req.email)}</a>`),
  ];

  if (req.phone) rows.push(row("Phone", escapeHtml(req.phone)));
  if (req.bestTimes) rows.push(row("Best times", escapeHtml(req.bestTimes)));

  const html =
    `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f5;">` +
    `<div style="max-width:560px;margin:0 auto 12px;font-family:sans-serif;font-size:13px;color:#666;">New audit request via /book</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;">` +
    rows.join("") +
    `</table>` +
    `<div style="max-width:560px;margin:12px auto 0;font-family:sans-serif;font-size:12px;color:#999;">Run the scan before the call, then open on their own answer.</div>` +
    `</body></html>`;

  return { subject, html };
}

export interface AuditRequestTransportArgs {
  to: string[];
  from: string;
  subject: string;
  html: string;
  replyTo: string;
}

export type AuditRequestTransport = (args: AuditRequestTransportArgs) => Promise<void>;

/**
 * Real transport. The `import("resend")` only happens when this actually runs,
 * so tests that inject their own transport never construct the SDK.
 */
const defaultTransport: AuditRequestTransport = async ({ to, from, subject, html, replyTo }) => {
  const { Resend } = await import("resend");
  const resend = new Resend(loadEnv().RESEND_API_KEY);
  await resend.emails.send({ from, to, subject, html, replyTo });
};

/**
 * Sends the notification to the sales inbox. Throws on transport failure —
 * unlike the Pulse, which swallows send errors because a missed weekly email is
 * recoverable. A dropped lead is not, so the caller surfaces the failure and
 * offers the visitor a direct mailto instead.
 */
export async function sendAuditRequest(
  req: AuditRequest,
  transport: AuditRequestTransport = defaultTransport,
): Promise<void> {
  const env = loadEnv();
  const { subject, html } = composeAuditRequest(req);

  await transport({
    to: [env.LEADS_EMAIL ?? env.OPERATOR_EMAIL],
    from: env.EMAIL_FROM,
    subject,
    html,
    // Lets the operator reply straight to the business from their inbox.
    replyTo: req.email,
  });
}

/**
 * Pure composer for the confirmation the prospect gets after submitting
 * /book. Sets expectations for the call (we scan first, then walk them
 * through their own answers) so the call starts warm, not cold.
 */
export function composeAuditConfirmation(req: AuditRequest, appName: string): { subject: string; html: string } {
  const subject = `We got your request: ${appName} audit for ${req.practiceName}`;
  const p = (text: string) =>
    `<p style="margin:0 0 14px;font-family:sans-serif;font-size:15px;line-height:1.5;color:#111;">${text}</p>`;
  const html =
    `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f5;">` +
    `<div style="max-width:560px;margin:0 auto;background:#fff;padding:28px;border-radius:8px;">` +
    p(`Hi ${escapeHtml(req.contactName)},`) +
    p(`Thanks for requesting an AI visibility audit for <strong>${escapeHtml(req.practiceName)}</strong>.`) +
    p(`Before we talk, we ask ChatGPT, Claude, Gemini, Grok and Perplexity the questions your customers ask, several times each, and record who they recommend, where they get their information, and anything they get wrong about you.`) +
    p(`On the call we'll walk you through your own results. It takes about thirty minutes and there's nothing to prepare.`) +
    p(`If you haven't picked a time yet, just reply to this email with a few that work.`) +
    p(`Talk soon,<br>The ${escapeHtml(appName)} team`) +
    `</div></body></html>`;
  return { subject, html };
}

/**
 * Sends the prospect's confirmation. Replies go to the sales inbox. Unlike
 * the internal notification this one is best-effort: the lead is already
 * safe in the inbox by the time it runs, so the caller swallows a failure.
 */
export async function sendAuditConfirmation(
  req: AuditRequest,
  transport: AuditRequestTransport = defaultTransport,
): Promise<void> {
  const env = loadEnv();
  const { subject, html } = composeAuditConfirmation(req, env.NEXT_PUBLIC_APP_NAME);
  await transport({
    to: [req.email],
    from: env.EMAIL_FROM,
    subject,
    html,
    replyTo: env.LEADS_EMAIL ?? env.OPERATOR_EMAIL,
  });
}
