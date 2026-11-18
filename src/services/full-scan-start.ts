import { sql } from "drizzle-orm";
import type { Db } from "@/db";

/**
 * Opens the full audit's scan row for a new business, once. Returns the scan
 * id for the first caller and null for any later one, so a quick scan whose
 * end is delivered twice still starts one full audit. One statement: the
 * check and the insert can't be split by another caller in between, short of
 * two arriving in the same instant.
 */
export async function claimFullScan(db: Db, practiceId: string, runs: number): Promise<string | null> {
  const stamped = new Date().toISOString();
  const res = await db.execute(sql`
    insert into scans (practice_id, runs, purpose, updated_at)
    select ${practiceId}::uuid, ${Math.max(1, Math.floor(runs))}::int, 'prospect', ${stamped}::timestamp
    where not exists (select 1 from scans where practice_id = ${practiceId}::uuid and purpose = 'prospect')
    returning id
  `);
  const rows = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows ?? []) as { id: string }[];
  return rows[0]?.id ?? null;
}

/**
 * Starts a business's full audit in a function call of its own, with a
 * request to /api/cron/scan-start, the way a scan step starts the next one.
 * The quick scan that asks for it has little of its own time left.
 */
export function makeFullScanTrigger(args: {
  appUrl: string;
  cronSecret: string;
  bypassSecret?: string;
  fetchImpl?: typeof fetch;
}): (practiceId: string) => Promise<void> {
  const base = args.appUrl.replace(/\/+$/, "");
  const doFetch = args.fetchImpl ?? fetch;
  return async practiceId => {
    const url = `${base}/api/cron/scan-start?practice=${encodeURIComponent(practiceId)}`;
    const headers: Record<string, string> = { authorization: `Bearer ${args.cronSecret}` };
    if (args.bypassSecret) headers["x-vercel-protection-bypass"] = args.bypassSecret;
    const res = await doFetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`scan-start ${res.status}`);
  };
}

/**
 * Runs the quick look, whose own end starts the full audit. If the quick look
 * throws instead (a dropped database call, say), that is no reason to fail the
 * lead: the full audit is asked for here and the visitor waits on that one.
 * Asking twice is safe, since the full scan can only be claimed once. Throws
 * only when the full audit can't be started either.
 */
export async function quickLookFirst(startQuick: () => Promise<unknown>, startFull: () => Promise<void>): Promise<"started"> {
  try {
    await startQuick();
  } catch (err) {
    console.error("quick look failed, going on to the full audit:", err);
    await startFull();
  }
  return "started";
}

/**
 * Opens a business's full audit and runs its first step. A scan that can't
 * even be opened leaves nothing for the stuck-scan sweep to find, so that
 * case is reported through `onNotStarted` and the lead is not left waiting on
 * an audit that will never come. Once the scan exists, a failing step is the
 * scan chain's own business.
 */
export async function startFullAudit(db: Db, practiceId: string, runs: number, deps: {
  runFirstStep: (scanId: string) => Promise<unknown>;
  onNotStarted: (reason: string) => Promise<void>;
}): Promise<void> {
  let scanId: string | null;
  try {
    // Null when the full audit was already started: a request delivered twice starts one.
    scanId = await claimFullScan(db, practiceId, runs);
  } catch (err) {
    const reason = String(err instanceof Error ? err.message : err).slice(0, 200);
    console.error(`full audit for practice ${practiceId} couldn't be opened:`, err);
    await deps.onNotStarted(reason).catch(e => console.error("couldn't report it:", e));
    return;
  }
  if (!scanId) return;
  try {
    await deps.runFirstStep(scanId);
  } catch (err) {
    console.error(`full audit ${scanId} failed in its first step:`, err);
  }
}
