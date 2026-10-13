import type { ReactNode } from "react";

/**
 * "See all" for lists longer than one sheet. The first items are on the page
 * itself; the rest are continuation sheets that stay folded on screen until
 * the button is pressed, and always print, so the PDF is never missing rows.
 *
 * The fold is a checkbox and CSS (see .report-more in report.css), with no
 * browser script, so the same markup renders on the server for the PDF.
 */
export function SeeAll({ hiddenCount, noun, children }: { hiddenCount: number; noun: string; children: ReactNode }) {
  if (hiddenCount <= 0) return null;
  return (
    <div className="report-more">
      <label className="report-more-button">
        <input type="checkbox" className="report-more-toggle" />
        <span className="report-more-closed">See all: {hiddenCount} more {noun}</span>
        <span className="report-more-open">Show fewer {noun}</span>
      </label>
      <div className="report-more-sheets">{children}</div>
    </div>
  );
}
