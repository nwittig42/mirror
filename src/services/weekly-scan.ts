import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { practices } from "@/db/schema";
import { runScan, type ScanOptions } from "@/services/scan-runner";
import { alertableFindings, sendAlert, sendBlockedAlert } from "@/services/alert-email";
import type { EngineAdapter } from "@/engines/types";
import type { judgeAnswer } from "@/services/hallucination-judge";
import type { extractCompetitors } from "@/services/competitor-extractor";

type Judge = typeof judgeAnswer;
type Extractor = typeof extractCompetitors;
type Send = typeof sendAlert;
type SendBlocked = typeof sendBlockedAlert;
type Practice = typeof practices.$inferSelect;

export type WeeklyScanResult =
  | { practice: string; score: number; alerted: number }
  | { practice: string; blocked: true }
  | { practice: string; error: string };

export interface WeeklyScanDeps {
  adapters: EngineAdapter[];
  judge: Judge;
  extractor: Extractor;
  send?: Send;
  sendBlocked?: SendBlocked;
  scanOptions?: ScanOptions;
}

/**
 * One practice's weekly scan: scan, then either the internal findings alert
 * or, when the scan was blocked for missing too many answers, the blocked
 * notice. The unit each /api/cron/scan-practice invocation runs, so every
 * practice gets its own function time budget.
 */
export async function scanPracticeWeekly(db: Db, practice: Practice, deps: WeeklyScanDeps): Promise<WeeklyScanResult> {
  const { send = sendAlert, sendBlocked = sendBlockedAlert } = deps;
  const summary = { id: practice.id, name: practice.name, slug: practice.slug };
  const result = await runScan(db, practice.id, deps.adapters, deps.judge, deps.extractor, deps.scanOptions);
  if (result.blocked || result.score === null) {
    await sendBlocked(db, summary, result.coverage);
    return { practice: practice.slug, blocked: true };
  }
  await send(db, summary, result.newFindings);
  // Reports what was *alerted on*, not every new finding: minor findings
  // never page the operator, so counting them here would misreport the
  // cron's own output.
  return { practice: practice.slug, score: result.score, alerted: alertableFindings(result.newFindings).length };
}

/**
 * What the weekly cron does now: start one scan per active practice via
 * `trigger` (a request to /api/cron/scan-practice), all at once. Scanning
 * them in one function ran out of time after a few practices. A failed
 * trigger is reported and never stops the others.
 */
export async function dispatchWeeklyScans(
  db: Db,
  trigger: (practiceId: string, index: number) => Promise<void>,
): Promise<{ practice: string; dispatched: boolean; error?: string }[]> {
  const activePractices = await db.select().from(practices).where(eq(practices.active, true));
  const settled = await Promise.allSettled(activePractices.map((p, i) => trigger(p.id, i)));
  return settled.map((r, i) => r.status === "fulfilled"
    ? { practice: activePractices[i].slug, dispatched: true }
    : { practice: activePractices[i].slug, dispatched: false, error: String(r.reason).slice(0, 200) });
}

/**
 * Scans every active practice one after another (tests and scripts; the
 * cron itself fans out through `dispatchWeeklyScans`) and, where the scan
 * opened new critical/major findings, sends the *internal* accuracy alert.
 *
 * The client-facing Pulse deliberately does NOT go out here. It runs on its
 * own cron the next morning (see runWeeklyPulses and vercel.json) so the
 * operator has a working day to fix what the scan found before the client
 * reads about it.
 *
 * Extracted from the route handler so it can be exercised in tests with fake
 * adapters/judge/send instead of the real engines and Resend SDK. The route
 * itself just wires real dependencies in.
 *
 * A failing practice (scan error, send error) is captured in its own result
 * row and never aborts the loop for the rest of the practices.
 */
export async function runWeeklyScans(
  db: Db,
  adapters: EngineAdapter[],
  judge: Judge,
  extractor: Extractor,
  send: Send = sendAlert,
  scanOptions: ScanOptions = {},
  sendBlocked: SendBlocked = sendBlockedAlert,
): Promise<WeeklyScanResult[]> {
  const activePractices = await db.select().from(practices).where(eq(practices.active, true));
  const results: WeeklyScanResult[] = [];

  for (const practice of activePractices) {
    try {
      results.push(await scanPracticeWeekly(db, practice, { adapters, judge, extractor, send, sendBlocked, scanOptions }));
    } catch (e) {
      results.push({ practice: practice.slug, error: String(e).slice(0, 200) });
    }
  }

  return results;
}

/**
 * Seconds practice `index` waits before it starts scanning. Every practice
 * uses the same engine API keys, so starting them all at once invites the
 * rate limits that get scans blocked. Twelve start slots, 25s apart: the
 * latest start (275s) still leaves over 8 minutes of the 800s budget.
 */
export function staggerSeconds(index: number): number {
  return (index % 12) * 25;
}

/**
 * The real trigger for `dispatchWeeklyScans`: a request to the per-practice
 * scan route. Times out rather than holding the 60s dispatcher, and sends
 * Vercel's protection-bypass header when one is configured so a protected
 * deployment doesn't answer every trigger with a 401.
 */
export function makeScanTrigger(args: {
  appUrl: string;
  cronSecret: string;
  bypassSecret?: string;
  fetchImpl?: typeof fetch;
}): (practiceId: string, index: number) => Promise<void> {
  const base = args.appUrl.replace(/\/+$/, "");
  const doFetch = args.fetchImpl ?? fetch;
  return async (practiceId, index) => {
    const url = `${base}/api/cron/scan-practice?id=${encodeURIComponent(practiceId)}&delay=${staggerSeconds(index)}`;
    const headers: Record<string, string> = { authorization: `Bearer ${args.cronSecret}` };
    if (args.bypassSecret) headers["x-vercel-protection-bypass"] = args.bypassSecret;
    const res = await doFetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`scan-practice ${res.status}`);
  };
}
