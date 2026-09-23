import { getDb } from "@/db";
import { loadEnv } from "@/lib/env";
import { runWeeklyPulses } from "@/services/weekly-pulse";

// Sends only, no engine calls, so this needs far less headroom than the scan
// route. Still generous enough for a slow email provider across every practice.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${loadEnv().CRON_SECRET}`) {
    return new Response("nope", { status: 401 });
  }
  const db = getDb();
  const results = await runWeeklyPulses(db);
  return Response.json({ results });
}
