import { after } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { practices } from "@/db/schema";
import { loadEnv } from "@/lib/env";
import { getAdapters } from "@/engines";
import { judgeAnswer } from "@/services/hallucination-judge";
import { extractCompetitors } from "@/services/competitor-extractor";
import { scanPracticeWeekly } from "@/services/weekly-scan";
import { SCAN_DEADLINE_MS } from "@/services/scan-runner";
import { scanStartedWithin } from "@/lib/queries";
import { rateTone } from "@/services/tone-rater";
import { runWebsiteCheck } from "@/services/website-check";
import { aiOverviewCheck } from "@/services/ai-overviews";

// One practice's weekly scan, started by /api/cron/weekly-scan. It answers at
// once and runs the scan in after(), inside this function's own time budget
// (800s needs a paid Vercel plan), so each practice gets the full budget
// instead of sharing one with every other practice.
// 300 is the most the Vercel Hobby plan allows; a Pro plan allows up to 800.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const env = loadEnv();
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("nope", { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response("missing id", { status: 400 });

  const db = getDb();
  const [practice] = await db.select().from(practices).where(eq(practices.id, id));
  if (!practice || !practice.active) return new Response("no such active practice", { status: 404 });

  // Vercel can deliver a cron twice. One weekly scan per practice: anything
  // started in the last 6 hours means this one already ran or is running.
  if (await scanStartedWithin(db, practice.id, 6 * 3_600_000)) {
    return Response.json({ skipped: practice.slug, reason: "scanned recently" });
  }

  // The dispatcher staggers starts so practices don't all hit the same API
  // keys at once. The wait counts against this function's budget, so the
  // scan's deadline shrinks by the same amount.
  const delaySec = Math.min(300, Math.max(0, Number(new URL(req.url).searchParams.get("delay")) || 0));
  const invokedAt = Date.now();

  after(async () => {
    await new Promise(resolve => setTimeout(resolve, delaySec * 1000));
    await scanPracticeWeekly(db, practice, {
      adapters: getAdapters(), judge: judgeAnswer, extractor: extractCompetitors,
      scanOptions: {
        runs: env.SCAN_RUNS, rateTone, checkWebsite: runWebsiteCheck, checkAiOverviews: aiOverviewCheck(),
        deadline: invokedAt + SCAN_DEADLINE_MS,
      },
    }).catch(err => console.error(`weekly scan failed for ${practice.slug}:`, err));
  });

  return Response.json({ queued: practice.slug }, { status: 202 });
}
