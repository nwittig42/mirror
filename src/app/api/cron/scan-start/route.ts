import { after } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { practices } from "@/db/schema";
import { loadEnv } from "@/lib/env";
import { runStep } from "@/services/scan-chain";
import { liveStepDeps } from "@/services/scan-live";
import { startFullAudit } from "@/services/full-scan-start";
import { fullAuditNotStarted, sweepStuckScans } from "@/services/scan-completion";

// Starts a new business's full audit once its quick look has ended, in this
// function's own 300s. Asked for by the quick scan's last step, which has
// little time of its own left. Answers at once and runs the first step in
// after(); later steps go through /api/cron/scan-step as for any scan.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const invokedAt = Date.now();
  const env = loadEnv();
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("nope", { status: 401 });
  }
  const practiceId = new URL(req.url).searchParams.get("practice");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!practiceId || !uuid.test(practiceId)) return new Response("missing practice", { status: 400 });

  const db = getDb();
  const [practice] = await db.select({ id: practices.id }).from(practices).where(eq(practices.id, practiceId));
  if (!practice) return new Response("no such practice", { status: 404 });

  after(async () => {
    await startFullAudit(db, practice.id, env.SCAN_RUNS, {
      runFirstStep: scanId => runStep(db, scanId, 1, liveStepDeps("prospect", invokedAt)),
      onNotStarted: reason => fullAuditNotStarted(db, practice.id, reason),
    });
    await sweepStuckScans(db).catch(err => console.error("stuck scan sweep failed:", err));
  });
  return Response.json({ practice: practice.id }, { status: 202 });
}
