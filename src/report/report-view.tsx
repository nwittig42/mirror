import type { AuditReport } from "@/report/types";
import { variantPages, type Variant } from "@/report/scoring";
import { PAGE_COMPONENTS } from "@/report/pages";
import "@/report/report.css";

/** Renders every sheet of one report variant, in order. */
export function ReportSheets({ report, variant }: { report: AuditReport; variant: Variant }) {
  const ids = variantPages[variant];
  return (
    <div className="report-sheets">
      {ids.map((id, i) => {
        const Page = PAGE_COMPONENTS[id];
        return Page ? <Page key={id} r={report} ctx={{ variant, index: i + 1, total: ids.length }} /> : null;
      })}
    </div>
  );
}
