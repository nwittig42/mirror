import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import { buildAuditReportData } from "@/report/build-report";
import { isVariant, pdfFileName } from "@/report/scoring";
import { renderReportPdf } from "@/services/report-pdf";

// Starting a headless browser and printing up to twelve sheets.
export const maxDuration = 60;

/**
 * One of the four reports as a finished PDF, made on request from the latest
 * scan. Same access rule as the dashboard: the customer's own business, or
 * an operator. 404 for an unknown report, before the first scan, or for
 * any report but the summary while the business is still a prospect.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { practice, locked } = await requirePracticeView(slug);
  const variant = req.nextUrl.searchParams.get("variant");
  if (!isVariant(variant)) return new NextResponse("Unknown report", { status: 404 });
  if (locked && variant !== "summary") return new NextResponse("This report unlocks after your call.", { status: 404 });

  const report = await buildAuditReportData(getDb(), practice.id);
  if (!report) return new NextResponse("The report is ready once the first scan finishes.", { status: 404 });

  const pdf = await renderReportPdf(report, variant);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${pdfFileName(slug, variant, report.scan.date)}"`,
      "cache-control": "private, no-store",
    },
  });
}
