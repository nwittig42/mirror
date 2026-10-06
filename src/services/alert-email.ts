import { loadEnv } from "@/lib/env";
import { escapeHtml } from "@/lib/html";
import { logActivity } from "@/services/activity";
import type { Db } from "@/db";
import type { NewFinding } from "@/services/scan-runner";
import { blockedReason, type Coverage } from "@/core/coverage";

/**
 * The internal accuracy alert: when a scan turns up a *new* critical or major
 * hallucination, the operator hears about it immediately, on scan day. The
 * client does not. They get the weekly Pulse the following morning, by which
 * point the operator has had a working day to fix the thing and the Pulse can
 * honestly read "handled" instead of "here is a fire".
 *
 * That gap is the entire reason the scan and the Pulse run on separate crons
 * (see vercel.json). Collapsing them back into one job silently removes the
 * window this email exists to create.
 *
 * Minor findings are deliberately excluded. They surface in the dashboard and
 * in the Pulse's open-issue count; paging the operator for them would train
 * them to ignore the alert, which costs more than the minor findings do.
 */

// Alerting severities, worst first. Also the display order inside the email.
const ALERT_SEVERITIES = ["critical", "major"] as const;

type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

const ENGINE_DISPLAY_NAMES: Record<string, string> = {
  openai: "ChatGPT",
  anthropic: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
};

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: "#b91c1c",
  major: "#c2410c",
};

export interface AlertArgs {
  practiceName: string;
  slug: string;
  findings: NewFinding[];
  appUrl: string;
}

/**
 * Narrows a scan's new findings to the ones worth an alert, ordered critical
 * before major. Exported because the caller needs the same answer to decide
 * whether to send at all, and two copies of this predicate would drift.
 */
export function alertableFindings(findings: NewFinding[]): NewFinding[] {
  return ALERT_SEVERITIES.flatMap(severity => findings.filter(f => f.severity === severity));
}

const findingBlock = (finding: NewFinding): string => {
  const engine = ENGINE_DISPLAY_NAMES[finding.engine] ?? finding.engine;
  const color = SEVERITY_COLORS[finding.severity as AlertSeverity] ?? "#c2410c";

  const truthRow = finding.factValue
    ? `<div style="font-size:15px;color:#111;margin-top:6px;"><strong>Truth:</strong> ${escapeHtml(finding.factValue)}</div>`
    : `<div style="font-size:14px;color:#666;margin-top:6px;font-style:italic;">No matching fact on the Fact Sheet. Verify before correcting.</div>`;

  return (
    `<div style="padding:16px 0;border-bottom:1px solid #e5e5e5;font-family:sans-serif;">` +
    `<div style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${color};">${escapeHtml(finding.severity)}</div>` +
    `<div style="font-size:15px;color:#111;margin-top:6px;"><strong>${escapeHtml(engine)} said:</strong> ${escapeHtml(finding.claim)}</div>` +
    truthRow +
    `<div style="font-size:13px;color:#666;margin-top:8px;">Prompt: &ldquo;${escapeHtml(finding.prompt)}&rdquo;</div>` +
    `</div>`
  );
};

/**
 * Pure composer for the alert. Kept free of DB and network so it is cheaply
 * unit-testable; `sendAlert` does the I/O. Mirrors `composePulse`.
 *
 * Returns null when nothing in `findings` clears the alerting bar, so the
 * caller has a single check for "is there anything to send".
 *
 * Every interpolated string passes through escapeHtml: `claim` is raw LLM
 * output and `prompt`/`factValue` are operator-typed, none of it trusted markup.
 */
export function composeAlert(args: AlertArgs): { subject: string; html: string } | null {
  const alertable = alertableFindings(args.findings);
  if (alertable.length === 0) return null;

  const counts = ALERT_SEVERITIES
    .map(severity => ({ severity, n: alertable.filter(f => f.severity === severity).length }))
    .filter(c => c.n > 0)
    .map(c => `${c.n} ${c.severity}`)
    .join(", ");

  const subject = `Mirror alert for ${args.practiceName}: ${counts}`;

  const accuracyUrl = `${args.appUrl}/dashboard/${encodeURIComponent(args.slug)}/accuracy`;

  const html =
    `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f5;">` +
    `<div style="max-width:560px;margin:0 auto 12px;font-family:sans-serif;font-size:13px;color:#666;">` +
    `Internal alert &middot; not sent to the client` +
    `</div>` +
    `<div style="max-width:560px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;">` +
    `<div style="font-family:sans-serif;font-size:17px;font-weight:700;color:#111;">${escapeHtml(args.practiceName)}</div>` +
    `<div style="font-family:sans-serif;font-size:14px;color:#666;margin-top:4px;">` +
    `New this scan. Their Pulse goes out tomorrow morning.` +
    `</div>` +
    alertable.map(findingBlock).join("") +
    `<div style="padding-top:16px;font-family:sans-serif;font-size:15px;">` +
    `<a href="${escapeHtml(accuracyUrl)}" style="color:#2563eb;text-decoration:none;font-weight:600;">Triage in the dashboard</a>` +
    `</div>` +
    `</div></body></html>`;

  return { subject, html };
}

export interface AlertTransportArgs {
  to: string;
  subject: string;
  html: string;
  from: string;
}

export type AlertTransport = (args: AlertTransportArgs) => Promise<void>;

/**
 * Real transport. The `import("resend")` only happens when this actually runs,
 * so tests that inject their own transport never construct the SDK. Mirrors
 * the same pattern in pulse-email.ts and audit-request.ts.
 */
const defaultTransport: AlertTransport = async ({ to, subject, html, from }) => {
  const { Resend } = await import("resend");
  const resend = new Resend(loadEnv().RESEND_API_KEY);
  await resend.emails.send({ from, to, subject, html });
};

/**
 * Sends the internal alert for one practice's scan. No-ops when nothing
 * clears the alerting bar.
 *
 * Send failures are logged as an activity and swallowed, matching the Pulse:
 * a flaky email provider must not fail the cron loop for the remaining
 * practices, and the findings are already durably in the database either way.
 */
export async function sendAlert(
  db: Db,
  practice: { id: string; name: string; slug: string },
  findings: NewFinding[],
  transport: AlertTransport = defaultTransport,
): Promise<void> {
  const env = loadEnv();

  const composed = composeAlert({
    practiceName: practice.name,
    slug: practice.slug,
    findings,
    appUrl: env.APP_URL,
  });
  if (!composed) return;

  try {
    await transport({
      to: env.ALERT_EMAIL ?? env.OPERATOR_EMAIL,
      subject: composed.subject,
      html: composed.html,
      from: env.EMAIL_FROM,
    });
  } catch (err) {
    await logActivity(
      db,
      practice.id,
      `alert email failed: ${String(err instanceof Error ? err.message : err).slice(0, 200)}`,
    );
  }
}

/**
 * The operator's notice that a scan was held back because too few answers
 * came back (see `summarizeCoverage`). Nothing reached the client: their
 * dashboard and report keep last week's scan. Pure, like `composeAlert`.
 */
export function composeBlockedAlert(args: {
  practiceName: string; slug: string; reason: string; appUrl: string;
}): { subject: string; html: string } {
  const subject = `Mirror: scan blocked for ${args.practiceName}`;
  const html =
    `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f5;">` +
    `<div style="max-width:560px;margin:0 auto 12px;font-family:sans-serif;font-size:13px;color:#666;">` +
    `Internal alert &middot; not sent to the client` +
    `</div>` +
    `<div style="max-width:560px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;font-family:sans-serif;">` +
    `<div style="font-size:17px;font-weight:700;color:#111;">${escapeHtml(args.practiceName)}: scan blocked</div>` +
    `<div style="font-size:15px;color:#111;margin-top:10px;">${escapeHtml(args.reason)}</div>` +
    `<div style="font-size:14px;color:#666;margin-top:10px;">` +
    `Last week's score stays up, and tomorrow's Pulse is skipped. Check the engine keys and billing, then run the scan again from admin.` +
    `</div>` +
    `<div style="padding-top:16px;font-size:15px;">` +
    `<a href="${escapeHtml(`${args.appUrl}/admin`)}" style="color:#2563eb;text-decoration:none;font-weight:600;">Open admin</a>` +
    `</div>` +
    `</div></body></html>`;
  return { subject, html };
}

/** Sends the blocked-scan notice. Failures are logged and swallowed, like `sendAlert`. */
export async function sendBlockedAlert(
  db: Db,
  practice: { id: string; name: string; slug: string },
  coverage: Coverage,
  transport: AlertTransport = defaultTransport,
): Promise<void> {
  const env = loadEnv();
  const { subject, html } = composeBlockedAlert({
    practiceName: practice.name, slug: practice.slug, reason: blockedReason(coverage), appUrl: env.APP_URL,
  });
  try {
    await transport({ to: env.ALERT_EMAIL ?? env.OPERATOR_EMAIL, subject, html, from: env.EMAIL_FROM });
  } catch (err) {
    await logActivity(
      db,
      practice.id,
      `blocked-scan email failed: ${String(err instanceof Error ? err.message : err).slice(0, 200)}`,
    );
  }
}

/** Operator notice for weekly scans that never started. Null when all did. */
export function composeDispatchAlert(
  results: { practice: string; dispatched: boolean; error?: string }[],
): { subject: string; html: string } | null {
  const failed = results.filter(r => !r.dispatched);
  if (failed.length === 0) return null;
  const subject = `Mirror: ${failed.length} weekly scan${failed.length === 1 ? "" : "s"} didn't start`;
  const html =
    `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f5;">` +
    `<div style="max-width:560px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;font-family:sans-serif;">` +
    `<div style="font-size:17px;font-weight:700;color:#111;">${escapeHtml(subject)}</div>` +
    `<div style="font-size:14px;color:#666;margin-top:6px;">No scan ran for these this week, so their Pulse is skipped. Run them from admin.</div>` +
    failed.map(f => `<div style="font-size:14px;color:#111;margin-top:10px;"><strong>${escapeHtml(f.practice)}</strong>: ${escapeHtml(f.error ?? "unknown error")}</div>`).join("") +
    `</div></body></html>`;
  return { subject, html };
}

/** Sends the dispatch notice, if any. Never throws: this runs in the cron. */
export async function sendDispatchAlert(
  results: { practice: string; dispatched: boolean; error?: string }[],
  transport: AlertTransport = defaultTransport,
): Promise<void> {
  const composed = composeDispatchAlert(results);
  if (!composed) return;
  const env = loadEnv();
  await transport({ to: env.ALERT_EMAIL ?? env.OPERATOR_EMAIL, ...composed, from: env.EMAIL_FROM })
    .catch(err => console.error("dispatch alert email failed:", err));
}

export interface ProspectAlertArgs {
  practiceName: string;
  practiceId: string | null;
  status: "ready" | "needs_attention";
  note: string | null;
  appUrl: string;
}

/** Operator notice that a new prospect's first report is ready, or needs a look. */
export function composeProspectAlert(a: ProspectAlertArgs): { subject: string; html: string } {
  const ready = a.status === "ready";
  const subject = ready
    ? `Report ready: ${a.practiceName}. Review it before the call`
    : `Needs a look: ${a.practiceName}'s report`;
  const link = a.practiceId ? `${a.appUrl}/admin/practices/${a.practiceId}/overview` : `${a.appUrl}/admin`;
  const html =
    `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f5;">` +
    `<div style="max-width:560px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;font-family:sans-serif;">` +
    `<div style="font-size:17px;font-weight:700;color:#111;">${escapeHtml(a.practiceName)}</div>` +
    `<div style="font-size:15px;color:#111;margin-top:8px;">` +
    (ready
      ? "They booked through the website. Their account, fact sheet, questions and first scan are done, and they've been emailed their one-page summary report as a PDF (no fact check yet; it asks them to book a fact-sheet call). Check the fact sheet and full report before the call: the facts were read off their website."
      : "They booked through the website, but setting up their report hit a problem.") +
    `</div>` +
    (a.note ? `<div style="font-size:14px;color:#666;margin-top:10px;">${escapeHtml(a.note)}</div>` : "") +
    `<div style="padding-top:16px;font-size:15px;"><a href="${escapeHtml(link)}" style="color:#2563eb;text-decoration:none;font-weight:600;">Open ${escapeHtml(a.practiceName)} in admin</a></div>` +
    `</div></body></html>`;
  return { subject, html };
}

/** Sends the prospect notice. Never throws: it runs in the background after a booking. */
export async function sendProspectAlert(
  args: Omit<ProspectAlertArgs, "appUrl">,
  transport: AlertTransport = defaultTransport,
): Promise<void> {
  const env = loadEnv();
  const composed = composeProspectAlert({ ...args, appUrl: env.APP_URL });
  await transport({ to: env.ALERT_EMAIL ?? env.OPERATOR_EMAIL, ...composed, from: env.EMAIL_FROM })
    .catch(err => console.error("prospect alert email failed:", err));
}
