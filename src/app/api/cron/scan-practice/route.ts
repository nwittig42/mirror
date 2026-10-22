import { after } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { practices } from "@/db/schema";
import { loadEnv } from "@/lib/env";
import { scanStartedWithin } from "@/lib/queries";
import { startScanChain } from "@/services/scan-chain";
import { liveStepDeps } from "@/services/scan-live";

// One practice's weekly scan, started by /api/cron/weekly-scan. It answers at
// once and runs the scan's first step in after(), inside this function's own
// 300s; later steps run in /api/cron/scan-step, each with its own 300s.
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
  // keys at once. The wait counts against the first step's budget, which
  // runs from when this function was invoked.
  const delaySec = Math.min(60, Math.max(0, Number(new URL(req.url).searchParams.get("delay")) || 0));
  const invokedAt = Date.now();

  after(async () => {
    await new Promise(resolve => setTimeout(resolve, delaySec * 1000));
    await startScanChain(db, practice.id, "weekly", liveStepDeps("weekly", invokedAt))
      .catch(err => console.error(`weekly scan failed for ${practice.slug}:`, err));
  });

  return Response.json({ queued: practice.slug }, { status: 202 });
}
