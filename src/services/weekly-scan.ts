import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { practices } from "@/db/schema";
import { runScan } from "@/services/scan-runner";
import { alertableFindings, sendAlert } from "@/services/alert-email";
import type { EngineAdapter } from "@/engines/types";
import type { judgeAnswer } from "@/services/hallucination-judge";
import type { extractCompetitors } from "@/services/competitor-extractor";

type Judge = typeof judgeAnswer;
type Extractor = typeof extractCompetitors;
type Send = typeof sendAlert;

export type WeeklyScanResult =
  | { practice: string; score: number; alerted: number }
  | { practice: string; error: string };

/**
 * Core loop for the scan cron: scans every active practice and, where the scan
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
): Promise<WeeklyScanResult[]> {
  const activePractices = await db.select().from(practices).where(eq(practices.active, true));
  const results: WeeklyScanResult[] = [];

  for (const practice of activePractices) {
    try {
      const { score, newFindings } = await runScan(db, practice.id, adapters, judge, extractor);
      await send(db, { id: practice.id, name: practice.name, slug: practice.slug }, newFindings);
      // Reports what was *alerted on*, not every new finding: minor findings
      // never page the operator, so counting them here would misreport the
      // cron's own output.
      results.push({ practice: practice.slug, score, alerted: alertableFindings(newFindings).length });
    } catch (e) {
      results.push({ practice: practice.slug, error: String(e).slice(0, 200) });
    }
  }

  return results;
}
