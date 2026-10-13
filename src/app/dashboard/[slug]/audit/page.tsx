import Link from "next/link";
import { requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import { buildAuditReportData } from "@/report/build-report";
import { ReportSheets } from "@/report/report-view";
import { VARIANT_INFO, isVariant, pageCountLabel } from "@/report/scoring";
import { PrintButton } from "@/components/print-button";
import { AutoPrint } from "@/components/auto-print";
import { Note, buttonClass } from "@/components/ui";

// The first view after a scan may run the website check (a few page loads).
export const maxDuration = 60;

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

/**
 * The report viewer: the reports built from the same scan, each page a US
 * Letter sheet. "Download PDF" asks the server for the finished file; Print
 * still works. A prospect before their call can open the summary only.
 *
 * This page owns the bar above the sheets. The sheets themselves, and the
 * .report-root box around them, belong to src/report.
 */
export default async function AuditPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ variant?: string; print?: string }>;
}) {
  const { slug } = await params;
  const { variant: raw, print } = await searchParams;
  const { practice, locked } = await requirePracticeView(slug);
  // With no report named in the address, open the fullest one (the last listed).
  const variant = locked ? "summary" : isVariant(raw) ? raw : VARIANT_INFO[VARIANT_INFO.length - 1].key;
  const report = await buildAuditReportData(getDb(), practice.id);
  const offered = VARIANT_INFO.filter(v => !locked || v.key === "summary");

  return (
    <>
      {/* As wide as one sheet (816px), so the bar lines up with the pages under it. */}
      <div className="mx-auto w-full max-w-[848px] px-4 pb-5 pt-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/dashboard/${slug}/reports`} className={`text-[15px] font-semibold text-muted hover:text-gold ${FOCUS}`}>
            ← Reports
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <PrintButton />
            {report && (
              <a href={`/dashboard/${slug}/reports/pdf?variant=${variant}`} download className={buttonClass("primary")}>
                Download PDF
              </a>
            )}
          </div>
        </div>
        {offered.length > 1 && (
          <nav className="mt-5 flex flex-wrap gap-2" aria-label="Reports">
            {offered.map(v => (
              <Link
                key={v.key}
                href={`/dashboard/${slug}/audit?variant=${v.key}`}
                aria-current={v.key === variant ? "page" : undefined}
                className={`rounded-2xl border px-4 py-2 leading-tight ${FOCUS} ${
                  v.key === variant ? "border-ink bg-ink text-ivory" : "border-line bg-paper text-ink hover:border-gold"
                }`}
              >
                <span className="block text-[15px] font-semibold">{v.label}</span>
                <span className={`block text-[12px] ${v.key === variant ? "text-bone" : "text-muted"}`}>{pageCountLabel(v.key)}</span>
              </Link>
            ))}
          </nav>
        )}
      </div>
      {report ? (
        // The sheets sit straight on the app's ivory page, not on a second backdrop.
        <div className="report-root bg-transparent! pt-0!">
          <ReportSheets report={report} variant={variant} />
          <AutoPrint when={print === "1"} />
        </div>
      ) : (
        <Note className="px-4 py-10 text-center">Your report is ready once the first scan finishes.</Note>
      )}
    </>
  );
}
