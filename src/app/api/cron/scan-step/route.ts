import { after } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { scans } from "@/db/schema";
import { loadEnv } from "@/lib/env";
import { runStep } from "@/services/scan-chain";
import { liveStepDeps } from "@/services/scan-live";
import { sweepStuckScans } from "@/services/scan-completion";
import type { ScanPurpose } from "@/services/scan-runner";

// One step of a running scan, started by the step before it. It answers at
// once and runs the step in after(), inside this function's own 300s, so a
// scan longer than any one function can run still finishes.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const invokedAt = Date.now();
  const env = loadEnv();
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("nope", { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  const scanId = params.get("scan");
  const step = Number(params.get("step"));
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!scanId || !uuid.test(scanId) || !Number.isInteger(step) || step < 2) {
    return new Response("missing scan or step", { status: 400 });
  }

  const db = getDb();
  const [scan] = await db.select({ id: scans.id, purpose: scans.purpose }).from(scans).where(eq(scans.id, scanId));
  if (!scan) return new Response("no such scan", { status: 404 });

  after(async () => {
    try {
      await runStep(db, scan.id, step, liveStepDeps(scan.purpose as ScanPurpose, invokedAt));
    } catch (err) {
      console.error(`scan ${scan.id} step ${step} failed:`, err);
    }
    await sweepStuckScans(db).catch(err => console.error("stuck scan sweep failed:", err));
  });
  return Response.json({ scan: scan.id, step }, { status: 202 });
}
