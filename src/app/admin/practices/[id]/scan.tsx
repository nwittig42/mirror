import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { triggerScan } from "@/app/admin/actions";
import { getLatestScan, getLatestScanAttempt, describeBand } from "@/lib/queries";
import { blockedReason, coverageLabel } from "@/core/coverage";
import { scanLooksStuck } from "@/services/scan-runner";
import { Card, Meter, Note, ScoreDial } from "@/components/ui";
import { Button, Notice, linkClass } from "@/app/admin/ui";
import { businessHref } from "./tabs";

/** Starts the scan, then lands back on the Scans tab with a "started" notice. */
async function handleTriggerScan(practiceId: string): Promise<void> {
  "use server";
  await triggerScan(practiceId);
  redirect(businessHref(practiceId, "scans", { scanStarted: "1" }));
}

/** Run a scan, and how the newest one went. */
export async function Scan({ practiceId, slug, scanStarted }: { practiceId: string; slug: string; scanStarted: boolean }) {
  const db = getDb();
  const [latestScan, latestAttempt] = await Promise.all([
    getLatestScan(db, practiceId),
    getLatestScanAttempt(db, practiceId),
  ]);

  // What happened to the newest scan when it isn't a clean, published one.
  const attemptDate = latestAttempt?.startedAt.toISOString().slice(0, 10);
  const attemptNote = !latestAttempt ? null
    : latestAttempt.status === "blocked" && latestAttempt.coverage
      ? `Latest attempt ${attemptDate} blocked: ${blockedReason(latestAttempt.coverage)}`
    : latestAttempt.status === "running"
      ? scanLooksStuck(latestAttempt.updatedAt)
        ? `Latest attempt ${attemptDate} stopped without finishing (it ran out of time). Run it again.`
        : `Scan running since ${latestAttempt.startedAt.toISOString().slice(0, 16).replace("T", " ")} UTC`
    : latestAttempt.status === "failed" ? `Latest attempt ${attemptDate} failed. See diagnostics below.`
    : coverageLabel(latestAttempt.coverage ?? null);
  const band = latestScan ? describeBand(latestScan) : null;
  const audit = (variant: string) => `/dashboard/${slug}/audit?variant=${variant}`;

  return (
    <Card title="Scan" aside={
      <form action={handleTriggerScan.bind(null, practiceId)}>
        <Button size="sm">Run scan now</Button>
      </form>
    }>
      {scanStarted && <Notice tone="ok" className="mb-4">Scan started. Refresh in about 5 minutes.</Notice>}
      {attemptNote && <Notice tone="gold" className="mb-4">{attemptNote}</Notice>}

      {latestScan ? (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
          <ScoreDial value={latestScan.score} label="Overall" size={132} />
          <div className="min-w-[240px] flex-1 space-y-4">
            <Meter label="Recommended by AI" value={latestScan.visibilityScore} />
            <Meter label="Accuracy" value={latestScan.factScore} />
            <Note>
              Latest finished scan: {latestScan.startedAt.toISOString().slice(0, 10)}{band ? ` · ${band}` : ""}
            </Note>
            <p className="flex flex-wrap gap-x-5 gap-y-1 text-[14px]">
              <Link href={audit("summary")} className={linkClass}>One-page summary</Link>
              <Link href={audit("master")} className={linkClass}>Full report</Link>
            </p>
          </div>
        </div>
      ) : <Note>No finished scan yet.</Note>}
      <Note className="mt-4">A scan asks every active question to every AI tool. It takes a few minutes and costs money to run.</Note>
    </Card>
  );
}
