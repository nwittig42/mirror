import Link from "next/link";
import { requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import { getLatestScan } from "@/lib/queries";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, Note, PageBody, Tag, buttonClass } from "@/components/ui";
import { BookCallButton } from "@/components/locked";
import { VARIANT_INFO, pageCountLabel } from "@/report/scoring";

/**
 * The customer's Reports tab: the reports built from the latest scan, each
 * to open on screen or download as a finished PDF, and the monthly report
 * underneath. A prospect before their call gets the summary; the other
 * reports are named, with what each holds, and nothing more.
 */
export default async function ReportsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { practice, locked } = await requirePracticeView(slug);
  const latestScan = await getLatestScan(getDb(), practice.id);
  const scanDate = latestScan?.startedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <PageBody>
      <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="reports" />
      {!latestScan ? (
        <Card title="Reports">
          <Note>Your first scan is running. Your reports appear here when it finishes.</Note>
        </Card>
      ) : (
        <div className="space-y-4">
          <Note>Built from the scan on {scanDate}. Each one updates after every scan.</Note>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {VARIANT_INFO.map(v => {
              const open = !locked || v.key === "summary";
              return (
                <Card key={v.key} title={v.label} aside={<span className="text-[13px] text-muted">{pageCountLabel(v.key)}</span>} className="flex flex-col">
                  <div className="text-[24px] font-semibold leading-tight tracking-tight text-ink">{v.title}</div>
                  <Note className="mb-5 mt-2">{v.blurb}</Note>
                  {open ? (
                    <div className="mt-auto flex flex-wrap gap-2">
                      <Link href={`/dashboard/${slug}/audit?variant=${v.key}`} className={buttonClass("outline")}>Open</Link>
                      {/* A plain link, not next/link: the answer is a file, not a page. */}
                      <a href={`/dashboard/${slug}/reports/pdf?variant=${v.key}`} download className={buttonClass("primary")}>Download PDF</a>
                    </div>
                  ) : (
                    <div className="mt-auto"><Tag>Unlocks after your call</Tag></div>
                  )}
                </Card>
              );
            })}
          </div>
          {locked ? (
            <Card title="Unlock the other reports">
              <p className="text-[15px] leading-relaxed text-ink-soft">
                On a 30-minute call we confirm your prices, services and hours with you, then open the rest of your reports.
              </p>
              <div className="mt-4"><BookCallButton /></div>
            </Card>
          ) : (
            <Card title="Monthly report" href={`/dashboard/${slug}/report`}>
              <div className="text-[24px] font-semibold leading-tight tracking-tight text-ink">Your month in review</div>
              <Note className="mt-2">Your score trend, what changed and the work log for the month.</Note>
            </Card>
          )}
        </div>
      )}
    </PageBody>
  );
}
