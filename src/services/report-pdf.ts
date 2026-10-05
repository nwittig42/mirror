import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { ReportSheets } from "@/report/report-view";
import type { Variant } from "@/report/scoring";
import type { AuditReport } from "@/report/types";

/** Chrome on a Mac, for making PDFs locally. On Vercel a bundled Chromium is used instead. */
export const LOCAL_CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

let css: string | null = null;
/** The report's own stylesheet, read once (see outputFileTracingIncludes in next.config). */
function reportCss(): string {
  css ??= readFileSync(path.join(process.cwd(), "src/report/report.css"), "utf8");
  return css;
}

/** A standalone HTML page of one report version: the same sheets the customer sees on screen. */
export async function reportHtml(report: AuditReport, variant: Variant): Promise<string> {
  // Loaded on use: Next won't let react-dom/server sit in the server
  // component graph as a static import.
  const { renderToStaticMarkup } = await import("react-dom/server");
  const body = renderToStaticMarkup(createElement(ReportSheets, { report, variant }));
  return `<!doctype html><html><head><meta charset="utf-8"><title>${report.business.name}</title>` +
    `<style>${reportCss()}</style></head><body style="margin:0"><div class="report-root">${body}</div></body></html>`;
}

async function launchBrowser() {
  const puppeteer = (await import("puppeteer-core")).default;
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
  return puppeteer.launch({ executablePath: LOCAL_CHROME, headless: true });
}

/**
 * Prints a report version to a PDF, exactly as "Print → Save as PDF" does in
 * the browser: US Letter, one sheet per page, colors kept.
 */
export async function renderReportPdf(report: AuditReport, variant: Variant): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(await reportHtml(report, variant), { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
