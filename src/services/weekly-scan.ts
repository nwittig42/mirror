import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { practices } from "@/db/schema";
import { runScan } from "@/services/scan-runner";
import { sendPulse } from "@/services/pulse-email";
import type { EngineAdapter } from "@/engines/types";
import type { judgeAnswer } from "@/services/hallucination-judge";

type Judge = typeof judgeAnswer;
type Send = typeof sendPulse;

export type WeeklyScanResult =
  | { practice: string; score: number }
  | { practice: string; error: string };

/**
 * Core loop for the weekly-scan cron: runs a scan and sends the Pulse email
 * for every active practice. Extracted from the route handler so it can be
 * exercised in tests with fake adapters/judge/send instead of the real
 * engines and Resend SDK — the route itself just wires real dependencies in.
 *
 * A failing practice (scan error, send error) is captured in its own result
 * row and never aborts the loop for the rest of the practices.
 */
export async function runWeeklyScans(
  db: Db,
  adapters: EngineAdapter[],
  judge: Judge,
  send: Send = sendPulse,
): Promise<WeeklyScanResult[]> {
  const activePractices = await db.select().from(practices).where(eq(practices.active, true));
  const results: WeeklyScanResult[] = [];

  for (const practice of activePractices) {
    try {
      const { score } = await runScan(db, practice.id, adapters, judge);
      await send(db, practice.id);
      results.push({ practice: practice.slug, score });
    } catch (e) {
      results.push({ practice: practice.slug, error: String(e).slice(0, 200) });
    }
  }

  return results;
}
