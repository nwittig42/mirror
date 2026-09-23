import { loadEnv } from "@/lib/env";
import { escapeHtml } from "@/lib/html";
import { logActivity } from "@/services/activity";
import type { Db } from "@/db";
import type { NewFinding } from "@/services/scan-runner";

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
    : `<div style="font-size:14px;color:#666;margin-top:6px;font-style:italic;">No matching fact on the Fact Sheet &mdash; verify before correcting.</div>`;

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

  const subject = `Mirror alert: ${args.practiceName} — ${counts}`;

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
