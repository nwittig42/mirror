import Link from "next/link";
import { requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import { getLatestScan } from "@/lib/queries";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, METRIC_COLOR } from "@/components/fitness";
import { BookCallButton } from "@/components/locked";
import { VARIANT_INFO, pageCountLabel } from "@/report/scoring";

const BUTTON = "flex-1 rounded-full px-4 py-2 text-center text-[15px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

/**
 * The customer's Reports tab: the four reports built from the latest scan,
 * each to open on screen or download as a finished PDF, and the monthly
 * report underneath. A prospect before their call gets the summary; the
 * other reports are named, with what each holds, and nothing more.
 */
export default async function ReportsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { practice, locked } = await requirePracticeView(slug);
  const latestScan = await getLatestScan(getDb(), practice.id);
  const scanDate = latestScan?.startedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <DashboardHeader slug={slug} practiceName={practice.name} active="reports" />
      {!latestScan ? (
        <Card title="Reports">
          <p className="text-[15px] text-[#aeaeb2]">Your first scan is running. Your reports appear here when it finishes.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] text-[#8e8e93]">Built from the scan on {scanDate}. Each one updates after every scan.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {VARIANT_INFO.map(v => locked && v.key !== "summary" ? (
              <Card key={v.key} title={v.title}>
                <p className="text-[13px] font-semibold text-[#8e8e93]">{v.label} · {pageCountLabel(v.key)}</p>
                <p className="mt-1 min-h-[44px] text-[15px] text-[#aeaeb2]">{v.blurb}</p>
                <p className="mt-4 rounded-full bg-[#2c2c2e] px-4 py-2 text-center text-[15px] font-semibold text-[#8e8e93]">Unlocks after your call</p>
              </Card>
            ) : (
              <Card key={v.key} title={v.title} color={METRIC_COLOR.overall}>
                <p className="text-[13px] font-semibold text-[#8e8e93]">{v.label} · {pageCountLabel(v.key)}</p>
                <p className="mt-1 min-h-[44px] text-[15px] text-[#aeaeb2]">{v.blurb}</p>
                <div className="mt-4 flex gap-2">
                  <Link href={`/dashboard/${slug}/audit?variant=${v.key}`} className={`${BUTTON} bg-[#2c2c2e] text-white hover:bg-[#3a3a3c]`}>
                    Open
                  </Link>
                  {/* A plain link, not next/link: the answer is a file, not a page. */}
                  <a href={`/dashboard/${slug}/reports/pdf?variant=${v.key}`} download className={`${BUTTON} bg-white text-black hover:bg-[#e5e5ea]`}>
                    Download PDF
                  </a>
                </div>
              </Card>
            ))}
          </div>
          {locked ? (
            <Card title="Unlock the other reports">
              <p className="text-[15px] text-[#aeaeb2]">
                On a 30-minute call we confirm your prices, services and hours with you, then open the fact check, the ranking snapshot and the full audit.
              </p>
              <div className="mt-4"><BookCallButton /></div>
            </Card>
          ) : (
            <Card title="Monthly report" href={`/dashboard/${slug}/report`}>
              <p className="text-[15px] text-[#aeaeb2]">Your score trend, what changed and the work log for the month.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
