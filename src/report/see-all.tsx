"use client";

import { useState, type ReactNode } from "react";

/**
 * "See all" for lists longer than one sheet. The first items are on the page
 * itself; the rest are continuation sheets that stay folded on screen until
 * the button is pressed, and always print, so the PDF is never missing rows.
 */
export function SeeAll({ hiddenCount, noun, children }: { hiddenCount: number; noun: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (hiddenCount <= 0) return null;
  return (
    <div className="report-more" data-open={open ? "true" : "false"}>
      <button type="button" className="report-more-button" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {open ? `Show fewer ${noun}` : `See all: ${hiddenCount} more ${noun}`}
      </button>
      <div className="report-more-sheets">{children}</div>
    </div>
  );
}
