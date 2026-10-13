"use client";

import { buttonClass } from "@/components/ui";

/** Opens the browser's own print window, where "Save as PDF" is one of the choices. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={`print:hidden ${buttonClass("outline")}`}>
      Print or save as PDF
    </button>
  );
}
