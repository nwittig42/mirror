"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_MS = 10_000;

/**
 * Keeps a dashboard that is waiting on a scan up to date: while `active`, it
 * asks the server for the page again every few seconds, so a result that
 * lands shows up without a reload. Stops as soon as the page says it is no
 * longer waiting.
 */
export function ScanRefresher({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
