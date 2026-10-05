import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import sample from "@/report/sample-audit.json";
import type { AuditReport } from "@/report/types";
import { reportHtml, renderReportPdf, LOCAL_CHROME } from "@/services/report-pdf";

const r = sample as unknown as AuditReport;

describe("report PDF", () => {
  it("builds a standalone page with the report's styles and content", async () => {
    const html = await reportHtml(r, "summary");
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain(".report-page");
    expect(html).toContain(r.business.name);
  });

  it.skipIf(!existsSync(LOCAL_CHROME))("prints it to a one-page PDF with local Chrome", async () => {
    const pdf = await renderReportPdf(r, "summary");
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect((pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length).toBe(1);
  }, 60_000);
});
