import { getDb } from "@/db";
import { loadEnv } from "@/lib/env";
import { runWeeklyPulses } from "@/services/weekly-pulse";

// Sends only, no engine calls, so this needs far less headroom than the scan
// route. 60s is the Hobby-plan ceiling and is enough for a handful of
// practices; raise to 300 on Pro (README ship checklist).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${loadEnv().CRON_SECRET}`) {
    return new Response("nope", { status: 401 });
  }
  const db = getDb();
  const results = await runWeeklyPulses(db);
  return Response.json({ results });
}
