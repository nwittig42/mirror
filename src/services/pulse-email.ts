import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { practiceMembers, practices, scans, users } from "@/db/schema";
import { getLatestScan, getChecksForScan, getOpenFindings } from "@/lib/queries";
import { loadEnv } from "@/lib/env";
import { logActivity } from "@/services/activity";

export interface PulseArgs {
  practiceName: string;
  score: number;
  prevScore: number | null;
  cited: number;
  total: number;
  bestQuote: { engine: string; snippet: string } | null;
  openFindings: number;
  appUrl: string;
  slug: string;
}

// Display names for the check `engine` enum, used in the verbatim-quote row.
const ENGINE_DISPLAY_NAMES: Record<string, string> = {
  openai: "ChatGPT",
  anthropic: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
};

const row = (content: string): string =>
  `<tr><td style="padding:12px 0;border-bottom:1px solid #e5e5e5;font-family:sans-serif;font-size:15px;color:#111;">${content}</td></tr>`;

/**
 * Pure composer for the weekly client "Pulse" email: an inline-styled HTML
 * table with at most 6 content rows (score/delta, cited-checks count,
 * verbatim quote, open-findings count, CTA). Kept pure (no DB/network) so
 * it's cheaply unit-testable — `sendPulse` below does the I/O.
 */
export function composePulse(args: PulseArgs): { subject: string; html: string } {
  const subject = `What AI told patients about ${args.practiceName} this week`;

  const rows: string[] = [];

  const delta = args.prevScore === null ? null : args.score - args.prevScore;
  const deltaText = delta === null ? "" : ` (${delta >= 0 ? "+" : ""}${delta})`;
  rows.push(row(`<strong>Score: ${args.score}${deltaText}</strong>`));

  rows.push(row(`AI answered ${args.cited} of ${args.total} checks with your practice cited.`));

  if (args.bestQuote) {
    const engineName = ENGINE_DISPLAY_NAMES[args.bestQuote.engine] ?? args.bestQuote.engine;
    rows.push(row(`${engineName} said: <em>&ldquo;${args.bestQuote.snippet}&rdquo;</em>`));
  }

  if (args.openFindings > 0) {
    const plural = args.openFindings === 1 ? "issue" : "issues";
    rows.push(row(`${args.openFindings} open accuracy ${plural} — we're on it.`));
  }

  const dashboardUrl = `${args.appUrl}/dashboard/${args.slug}`;
  rows.push(row(
    `<a href="${dashboardUrl}" style="color:#2563eb;text-decoration:none;font-weight:600;">Open your Mirror dashboard</a>`,
  ));

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f5;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;">` +
    rows.join("") +
    `</table></body></html>`;

  return { subject, html };
}

/**
 * Very small "best sentence" heuristic: splits the answer on ". " and
 * returns the first sentence that contains the practice name, truncated to
 * ~160 chars. Not NLP — good enough to surface a relevant verbatim snippet
 * for the email without another judge/LLM round trip.
 */
function extractSnippet(answerText: string, practiceName: string): string | null {
  const sentences = answerText.split(". ");
  const hit = sentences.find(s => s.toLowerCase().includes(practiceName.toLowerCase()));
  if (!hit) return null;
  return hit.length > 160 ? `${hit.slice(0, 160)}…` : hit;
}

/**
 * Loads the latest complete scan for a practice, composes the Pulse email,
 * and sends it to every user linked via practice_members. Skips silently if
 * there's no complete scan yet (e.g. first cron run before onboarding
 * finishes). Send failures are logged as an activity and swallowed — a
 * flaky email provider should never fail the cron loop for other practices.
 */
export async function sendPulse(db: Db, practiceId: string): Promise<void> {
  const latest = await getLatestScan(db, practiceId);
  if (!latest) return;

  const [practice] = await db.select().from(practices).where(eq(practices.id, practiceId));
  if (!practice) return;

  const [recentScans, checks, openFindings, memberRows] = await Promise.all([
    db.select().from(scans)
      .where(and(eq(scans.practiceId, practiceId), eq(scans.status, "complete")))
      .orderBy(desc(scans.startedAt))
      .limit(2),
    getChecksForScan(db, latest.id),
    getOpenFindings(db, practiceId),
    db.select({ email: users.email })
      .from(practiceMembers)
      .innerJoin(users, eq(practiceMembers.userId, users.id))
      .where(eq(practiceMembers.practiceId, practiceId)),
  ]);

  const prevScore = recentScans.length > 1 ? (recentScans[1].score ?? null) : null;

  const cited = checks.filter(c => c.mentioned).length;
  const total = checks.length;

  const firstMentioned = checks.find(c => c.mentioned);
  const snippet = firstMentioned ? extractSnippet(firstMentioned.answerText, practice.name) : null;
  const bestQuote = firstMentioned && snippet ? { engine: firstMentioned.engine, snippet } : null;

  const recipients = memberRows.map(m => m.email);
  if (recipients.length === 0) return;

  const { subject, html } = composePulse({
    practiceName: practice.name,
    score: latest.score ?? 0,
    prevScore,
    cited,
    total,
    bestQuote,
    openFindings: openFindings.length,
    appUrl: loadEnv().APP_URL,
    slug: practice.slug,
  });

  try {
    // Imported lazily so `sendPulse` (and everything that transitively
    // imports this module, e.g. runWeeklyScans) never constructs the Resend
    // SDK in tests that never hit this branch.
    const { Resend } = await import("resend");
    const env = loadEnv();
    const resend = new Resend(env.RESEND_API_KEY);
    await resend.emails.send({ from: env.EMAIL_FROM, to: recipients, subject, html });
  } catch (err) {
    await logActivity(db, practiceId, `pulse email failed: ${String(err instanceof Error ? err.message : err).slice(0, 200)}`);
  }
}
