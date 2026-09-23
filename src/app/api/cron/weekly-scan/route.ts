import { getDb } from "@/db";
import { loadEnv } from "@/lib/env";
import { getAdapters } from "@/engines";
import { judgeAnswer } from "@/services/hallucination-judge";
import { extractCompetitors } from "@/services/competitor-extractor";
import { runWeeklyScans } from "@/services/weekly-scan";

// Vercel needs an explicit maxDuration to let this route run long enough for
// a full round of practice scans (each scan fires every prompt at every
// engine, sequentially per prompt). 800s requires a paid Vercel plan. The
// Hobby plan caps every function at 60s, which is not enough for even one
// practice, so on Hobby this cron will time out mid-scan and leave the
// `scans` row stuck `running`. Raise to 800 on Pro (README ship checklist).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${loadEnv().CRON_SECRET}`) {
    return new Response("nope", { status: 401 });
  }
  const db = getDb();
  const results = await runWeeklyScans(db, getAdapters(), judgeAnswer, extractCompetitors);
  return Response.json({ results });
}
