import Link from "next/link";
import { requirePracticeAccess } from "@/lib/auth";
import { getDb } from "@/db";
import { buildAuditReportData } from "@/report/build-report";
import { ReportSheets } from "@/report/report-view";
import type { Variant } from "@/report/scoring";
import { PrintButton } from "@/components/print-button";
import { AutoPrint } from "@/components/auto-print";

// The first view after a scan may run the website check (a few page loads).
export const maxDuration = 60;

const VARIANTS: { key: Variant; label: string; blurb: string }[] = [
  { key: "summary", label: "Summary", blurb: "1 page · scores, top problems, top fixes" },
  { key: "visibility", label: "Ranking snapshot", blurb: "5 pages · where you rank, right after the scan" },
  { key: "factcheck", label: "Fact check", blurb: "4 pages · what AI gets wrong about you" },
  { key: "master", label: "Full audit", blurb: "12 pages · everything" },
];

/**
 * The client audit report, in three versions built from the same scan:
 * the ranking snapshot, the fact check, and the full audit. Each page is a
 * US Letter sheet; Print, then Save as PDF, gives the PDF.
 */
export default async function AuditPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ variant?: string; print?: string }>;
}) {
  const { slug } = await params;
  const { variant: raw, print } = await searchParams;
  const variant = VARIANTS.find(v => v.key === raw)?.key ?? "master";
  const practice = await requirePracticeAccess(slug);
  const report = await buildAuditReportData(getDb(), practice.id);

  return (
    <div className="report-root">
      <div className="report-toolbar">
        <Link href={`/dashboard/${slug}`} style={{ color: "#475569", textDecoration: "none" }}>← Dashboard</Link>
        <PrintButton />
      </div>
      <div className="report-toolbar" style={{ justifyContent: "flex-start", gap: 8 }}>
        {VARIANTS.map(v => (
          <Link key={v.key} href={`/dashboard/${slug}/audit?variant=${v.key}`}
            style={{
              padding: "8px 14px", borderRadius: 10, textDecoration: "none", lineHeight: 1.3,
              background: v.key === variant ? "#0F172A" : "#FFFFFF", color: v.key === variant ? "#FFFFFF" : "#0F172A",
              border: "1px solid #CBD5E1",
            }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>{v.label}</span>
            <span style={{ display: "block", fontSize: 11, opacity: 0.75 }}>{v.blurb}</span>
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
