"use client";

import { useEffect } from "react";

/**
 * Opens the print dialog once the page has drawn, when the URL asks for it
 * (`?print=1`). That's how admin's "Download PDF" works: the real report page,
 * then Save as PDF, the same PDF the customer gets.
 */
export function AutoPrint({ when }: { when: boolean }) {
  useEffect(() => {
    if (!when) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [when]);
  return null;
}
