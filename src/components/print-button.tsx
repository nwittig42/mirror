"use client";

/** Triggers the browser's native print dialog — the report's deliverable PDF is Print > Save as PDF, no PDF library involved. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-black hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
    >
      Print or save as PDF
    </button>
  );
}
