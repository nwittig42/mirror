import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { nameVariations, practiceMembers, practices, scans, users } from "@/db/schema";
import { getLatestScanAttempt, getChecksForScan, getOpenFindings } from "@/lib/queries";
import { coverageLabel, ENGINE_NAMES } from "@/core/coverage";
import { loadEnv } from "@/lib/env";
import { escapeHtml } from "@/lib/html";
import { logActivity } from "@/services/activity";
import { extractSnippet } from "@/core/mention";
import { emailButton, emailLabel, emailNote, emailNumber, emailQuote, emailShell, emailText } from "@/services/email-shell";

export interface PulseArgs {
  practiceName: string;
  score: number;
  prevScore: number | null;
  cited: number;
  total: number;
  bestQuote: { engine: string; snippet: string } | null;
  openFindings: number;
  /** "Based on 4 of 5 AI tools. Gemini didn't respond." when the scan was short. */
  coverageNote: string | null;
  appUrl: string;
  slug: string;
}

// Every dynamic string interpolated into `composePulse`'s HTML output MUST
// pass through escapeHtml. `bestQuote.snippet` in particular is raw
// third-party LLM output, not trusted content, so it can contain arbitrary
// markup (including script tags) unless neutralized. Shared with
// audit-request.ts, which has the same requirement for visitor-typed input.

/**
 * Pure composer for the weekly client "Pulse" email, in the shared Mirror
 * email look (see email-shell.ts). At most 6 content rows: the Overall score
 * and its change, the short-scan note, how often AI recommended them, one
 * verbatim quote, the open accuracy count, and the one button. Kept pure (no
 * DB/network) so it's cheaply unit-testable. `sendPulse` below does the I/O.
 */
export function composePulse(args: PulseArgs): { subject: string; html: string } {
  const subject = `What AI told customers about ${args.practiceName} this week`;

  const rows: string[] = [];

  const delta = args.prevScore === null ? null : args.score - args.prevScore;
  const deltaText = delta === null || delta === 0 ? "" : `${delta > 0 ? "+" : ""}${delta} since your last scan`;
  rows.push(
    emailLabel("Overall") +
    emailNumber(String(args.score), deltaText, delta !== null && delta > 0 ? "good" : "secondary") +
    // The short-scan note sits right under the score it qualifies.
    (args.coverageNote ? emailText(escapeHtml(args.coverageNote), "caption", 13) : ""),
  );

  // Says what the denominator is. The count deliberately excludes questions
  // that named the business, since those are answered with the name every time
  // and would overstate how often AI recommends them.
  rows.push(
    emailLabel("Recommended by AI") +
    emailText(`<strong>Named in ${args.cited} of ${args.total} answers</strong> to questions that didn't mention you by name.`),
  );

  if (args.bestQuote) {
    const engineName = (ENGINE_NAMES as Record<string, string>)[args.bestQuote.engine] ?? escapeHtml(args.bestQuote.engine);
    rows.push(
      emailLabel("In AI's own words") +
      emailQuote(`&ldquo;${escapeHtml(args.bestQuote.snippet)}&rdquo;`, `${engineName} said:`),
    );
  }

  if (args.openFindings > 0) {
    const one = args.openFindings === 1;
    rows.push(
      emailLabel("Accuracy") +
      emailNote(`<strong>${args.openFindings} open accuracy ${one ? "issue" : "issues"}.</strong> We're fixing ${one ? "it" : "them"}.`, "bad"),
    );
  }

  const dashboardUrl = `${args.appUrl}/dashboard/${encodeURIComponent(args.slug)}`;
  rows.push(emailButton(dashboardUrl, "Open your dashboard"));

  const html = emailShell({
    eyebrowHtml: "Weekly Pulse",
    titleHtml: escapeHtml(args.practiceName),
    blocks: rows,
  });

  return { subject, html };
}

export interface PulseTransportArgs {
  to: string[];
  subject: string;
  html: string;
  from: string;
}

export type PulseTransport = (args: PulseTransportArgs) => Promise<void>;

/**
 * Real transport: constructs the Resend SDK and sends. The `import("resend")`
 * only happens when THIS function actually runs. `sendPulse` only calls it
 * when the caller hasn't injected its own `transport`, so tests that pass a
 * fake transport (e.g. `runWeeklyScans` tests, via a fake `send`) never
 * construct the Resend SDK.
 */
const defaultTransport: PulseTransport = async ({ to, subject, html, from }) => {
  const { Resend } = await import("resend");
  const resend = new Resend(loadEnv().RESEND_API_KEY);
  await resend.emails.send({ from, to, subject, html });
};

/**
 * Loads the latest complete scan for a practice, composes the Pulse email,
 * and sends it to every user linked via practice_members. Skips silently if
 * there's no complete scan yet (e.g. first cron run before onboarding
 * finishes). Send failures are logged as an activity and swallowed, because a
 * flaky email provider should never fail the cron loop for other practices.
 *
 * `transport` defaults to the real lazy-Resend implementation above; tests
 * inject a fake to assert on the composed subject/html/recipients without
 * touching the network.
 */
const PULSE_MAX_SCAN_AGE_MS = 3 * 86_400_000;

export async function sendPulse(
  db: Db,
  practiceId: string,
  transport: PulseTransport = defaultTransport,
): Promise<void> {
  // Only the newest scan attempt can be this week's news. If it was blocked
  // or failed, the latest *complete* scan is last week's, already sent.
  const latest = await getLatestScanAttempt(db, practiceId);
  if (!latest || latest.status !== "complete") return;
  // The Pulse goes out the morning after the scan. A newest scan older than
  // that means this week's never started, and last week's is already sent.
  if (Date.now() - latest.startedAt.getTime() > PULSE_MAX_SCAN_AGE_MS) return;

  const [practice] = await db.select().from(practices).where(eq(practices.id, practiceId));
  if (!practice) return;

  const [recentScans, checks, openFindings, memberRows, variationRows] = await Promise.all([
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
    db.select().from(nameVariations).where(eq(nameVariations.practiceId, practiceId)),
  ]);

  const prevScore = recentScans.length > 1 ? (recentScans[1].score ?? null) : null;

  // Branded prompts name the practice in the question, so the answer names it
  // back whether or not anyone could actually find them. Counting those would
  // report a practice that never surfaces as being cited most of the time.
  const visibilityChecks = checks.filter(c => c.promptKind !== "branded");
  const cited = visibilityChecks.filter(c => c.mentioned).length;
  const total = visibilityChecks.length;

  // Same name set `checks.mentioned` is derived from in scan-runner
  // (practice name + all variations). Matters because a check can be
  // `mentioned: true` purely off a variation match, with the practice's
  // canonical name never appearing verbatim in that answer.
  const practiceNames = Array.from(new Set([practice.name, ...variationRows.map(v => v.text)]));

  // Prefer a mention the practice earned. Quoting a branded answer directly
  // under a "named in 0 of N answers" line reads as a contradiction, since
  // that quote only exists because the question supplied the name.
  const firstMentioned = visibilityChecks.find(c => c.mentioned) ?? checks.find(c => c.mentioned);
  // The names the scan counted alongside the business, so a list answer
  // ("Harbor Plumbing and Rose City Plumbing are both good") is quoted
  // rather than read as one longer name and dropped.
  const snippet = firstMentioned
    ? extractSnippet(firstMentioned.answerText, practiceNames,
        [...firstMentioned.competitorsMentioned, ...firstMentioned.namedOrder])
    : null;
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
    // Only wrong facts the latest scan repeated count toward its fact score.
    openFindings: openFindings.filter(f => f.lastSeenScanId === latest.id).length,
    coverageNote: coverageLabel(latest.coverage ?? null),
    appUrl: loadEnv().APP_URL,
    slug: practice.slug,
  });

  try {
    await transport({ to: recipients, subject, html, from: loadEnv().EMAIL_FROM });
  } catch (err) {
    await logActivity(db, practiceId, `pulse email failed: ${String(err instanceof Error ? err.message : err).slice(0, 200)}`);
  }
}
