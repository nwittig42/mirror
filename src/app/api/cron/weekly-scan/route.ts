import { getDb } from "@/db";
import { loadEnv } from "@/lib/env";
import { getAdapters } from "@/engines";
import { judgeAnswer } from "@/services/hallucination-judge";
import { extractCompetitors } from "@/services/competitor-extractor";
import { runWeeklyScans } from "@/services/weekly-scan";

// Vercel needs an explicit maxDuration to let this route run long enough for
// a full round of practice scans (each scan fires every prompt at every
// engine, sequentially per prompt). 800s requires a paid Vercel plan; the
// free tier caps functions at 10s (Hobby) / 60s (some configs), which is not
// enough headroom for more than a couple of practices.
export const maxDuration = 800;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${loadEnv().CRON_SECRET}`) {
    return new Response("nope", { status: 401 });
  }
  const db = getDb();
  const results = await runWeeklyScans(db, getAdapters(), judgeAnswer, extractCompetitors);
  return Response.json({ results });
}
