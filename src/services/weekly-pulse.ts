import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { practices } from "@/db/schema";
import { sendPulse } from "@/services/pulse-email";

type Send = typeof sendPulse;

export type WeeklyPulseResult =
  | { practice: string; sent: true }
  | { practice: string; error: string };

/**
 * Core loop for the Pulse cron: sends every active practice's client-facing
 * weekly email off the most recent complete scan.
 *
 * Runs on its own schedule, the morning after the scan cron, so the operator
 * gets a working day to act on the internal alert before the client reads
 * about the same findings. `sendPulse` reads the latest complete scan, so a
 * practice whose scan failed the day before simply re-sends against its last
 * good scan rather than going silent.
 *
 * As with the scan loop, one practice's failure never aborts the rest.
 */
export async function runWeeklyPulses(db: Db, send: Send = sendPulse): Promise<WeeklyPulseResult[]> {
  const activePractices = await db.select().from(practices).where(eq(practices.active, true));
  const results: WeeklyPulseResult[] = [];

  for (const practice of activePractices) {
    try {
      await send(db, practice.id);
      results.push({ practice: practice.slug, sent: true });
    } catch (e) {
      results.push({ practice: practice.slug, error: String(e).slice(0, 200) });
    }
  }

  return results;
}
