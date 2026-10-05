import { getDb } from "@/db";
import { loadEnv } from "@/lib/env";
import { dispatchWeeklyScans, makeScanTrigger } from "@/services/weekly-scan";
import { sendDispatchAlert } from "@/services/alert-email";

// The weekly cron no longer scans. It starts one /api/cron/scan-practice
// request per active practice, each of which answers at once and scans in its
// own function. Scanning everyone here ran out of time after 2-4 practices.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const env = loadEnv();
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("nope", { status: 401 });
  }
  const results = await dispatchWeeklyScans(getDb(), makeScanTrigger({
    appUrl: env.APP_URL, cronSecret: env.CRON_SECRET, bypassSecret: env.VERCEL_AUTOMATION_BYPASS_SECRET,
  }));
  // A scan that never started leaves no trace but this JSON, so say so.
  await sendDispatchAlert(results);
  return Response.json({ results });
}
