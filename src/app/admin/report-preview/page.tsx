import Link from "next/link";
import { requireOperator } from "@/lib/auth";
import sample from "@/report/sample-audit.json";
import type { AuditReport } from "@/report/types";
import type { Variant } from "@/report/scoring";
import { ReportSheets } from "@/report/report-view";

const VARIANTS: Variant[] = ["summary", "master", "visibility", "factcheck"];

/** Operators only: the report rendered from the design's sample data, to compare against the approved design. */
export default async function ReportPreviewPage({ searchParams }: { searchParams: Promise<{ variant?: string }> }) {
  await requireOperator();
  const { variant: raw } = await searchParams;
  const variant = (VARIANTS as string[]).includes(raw ?? "") ? (raw as Variant) : "master";
  return (
    <div className="report-root">
      <div className="report-toolbar">
        <span style={{ fontWeight: 700 }}>Design preview (sample data)</span>
        <span style={{ display: "flex", gap: 12 }}>
          {VARIANTS.map(v => (
            <Link key={v} href={`/admin/report-preview?variant=${v}`} style={{ fontWeight: v === variant ? 800 : 500 }}>{v}</Link>
          ))}
        </span>
      </div>
      <ReportSheets report={sample as unknown as AuditReport} variant={variant} />
    </div>
  );
}
