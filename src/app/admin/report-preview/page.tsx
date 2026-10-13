import Link from "next/link";
import { requireOperator } from "@/lib/auth";
import sample from "@/report/sample-audit.json";
import type { AuditReport } from "@/report/types";
import type { Variant } from "@/report/scoring";
import { ReportSheets } from "@/report/report-view";
import { Note } from "@/components/ui";
import { ADMIN_WIDTH, actionClass } from "@/app/admin/ui";

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "summary", label: "One-page summary" },
  { key: "master", label: "Full report" },
];

/** Operators only: the report rendered from the design's sample data, to compare against the approved design. */
export default async function ReportPreviewPage({ searchParams }: { searchParams: Promise<{ variant?: string }> }) {
  await requireOperator();
  const { variant: raw } = await searchParams;
  const variant: Variant = VARIANTS.find(v => v.key === raw)?.key ?? "master";
  return (
    <>
      <div className={`${ADMIN_WIDTH} pb-6 pt-8 print:hidden`}>
        <h1 className="text-[34px] font-semibold leading-tight tracking-tight text-ink">Report preview</h1>
        <Note className="mt-2">Each report with sample data, to check the design. No customer data here.</Note>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Report type">
          {VARIANTS.map(v => (
            <Link key={v.key} href={`/admin/report-preview?variant=${v.key}`}
              aria-current={v.key === variant ? "page" : undefined}
              className={actionClass(v.key === variant ? "primary" : "outline", "sm")}>
              {v.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="report-root">
        <ReportSheets report={sample as unknown as AuditReport} variant={variant} />
      </div>
    </>
  );
}
