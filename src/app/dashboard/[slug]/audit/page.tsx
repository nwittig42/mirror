import Link from "next/link";
import { requirePracticeAccess } from "@/lib/auth";
import { getDb } from "@/db";
import { buildAuditReportData } from "@/report/build-report";
import { ReportSheets } from "@/report/report-view";
import { VARIANT_INFO, isVariant, pageCountLabel } from "@/report/scoring";
import { PrintButton } from "@/components/print-button";
import { AutoPrint } from "@/components/auto-print";

// The first view after a scan may run the website check (a few page loads).
export const maxDuration = 60;

/**
 * The report viewer: the four reports built from the same scan (summary,
 * ranking snapshot, fact check, full audit), each page a US Letter sheet.
 * "Download PDF" asks the server for the finished file; Print still works.
 */
export default async function AuditPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ variant?: string; print?: string }>;
}) {
  const { slug } = await params;
  const { variant: raw, print } = await searchParams;
  const variant = isVariant(raw) ? raw : "master";
  const practice = await requirePracticeAccess(slug);
  const report = await buildAuditReportData(getDb(), practice.id);

  return (
    <div className="report-root">
      <div className="report-toolbar">
        <Link href={`/dashboard/${slug}/reports`} style={{ color: "#475569", textDecoration: "none" }}>← Reports</Link>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {report && (
            <a href={`/dashboard/${slug}/reports/pdf?variant=${variant}`} download
              style={{
                padding: "6px 12px", borderRadius: 6, background: "#0F172A", color: "#FFFFFF",
                fontSize: 14, fontWeight: 600, textDecoration: "none",
              }}>
              Download PDF
            </a>
          )}
          <PrintButton />
        </span>
      </div>
      <div className="report-toolbar" style={{ justifyContent: "flex-start", gap: 8 }}>
        {VARIANT_INFO.map(v => (
          <Link key={v.key} href={`/dashboard/${slug}/audit?variant=${v.key}`}
            style={{
              padding: "8px 14px", borderRadius: 10, textDecoration: "none", lineHeight: 1.3,
              background: v.key === variant ? "#0F172A" : "#FFFFFF", color: v.key === variant ? "#FFFFFF" : "#0F172A",
              border: "1px solid #CBD5E1",
            }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>{v.label}</span>
            <span style={{ display: "block", fontSize: 11, opacity: 0.75 }}>{pageCountLabel(v.key)}</span>
          </Link>
        ))}
      </div>
      {report ? (
        <>
          <ReportSheets report={report} variant={variant} />
          <AutoPrint when={print === "1"} />
        </>
      ) : (
        <p style={{ textAlign: "center", color: "#475569" }}>The report is ready once the first scan finishes.</p>
      )}
    </div>
  );
}
