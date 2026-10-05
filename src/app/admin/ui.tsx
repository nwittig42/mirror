import Link from "next/link";
import type { ReactNode } from "react";

/** Colors from the admin customer-view design (docs handoff, Oct 2026). */
export const ACCENT = "oklch(0.52 0.19 265)";
export const ACCENT_TEXT = "oklch(0.45 0.19 265)";

export type Tone = "red" | "amber" | "green" | "gray" | "blue";
const TONE_HUE: Record<Tone, number | null> = { red: 25, amber: 75, green: 150, gray: null, blue: 250 };

export function toneColors(tone: Tone) {
  const h = TONE_HUE[tone];
  return h === null
    ? { bg: "oklch(0.95 0 0)", fg: "oklch(0.42 0 0)" }
    : { bg: `oklch(0.95 0.05 ${h})`, fg: `oklch(0.42 0.13 ${h})` };
}

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const c = toneColors(tone);
  return (
    <span className="inline-block whitespace-nowrap rounded-full px-[9px] py-[3px] text-xs font-medium"
      style={{ background: c.bg, color: c.fg }}>
      {children}
    </span>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-block whitespace-nowrap rounded-md px-3 py-2 text-[13px] font-medium text-white hover:opacity-90"
      style={{ background: ACCENT }}>
      {children}
    </Link>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-block whitespace-nowrap rounded-md border border-zinc-300 bg-white px-3 py-2 text-[13px] font-medium text-black hover:border-zinc-500">
      {children}
    </Link>
  );
}

/** "← All customers": back to the main admin page. */
export function BackToAdmin() {
  return (
    <Link href="/admin" className="text-sm text-zinc-600 underline-offset-2 hover:text-black hover:underline">
      ← All customers
    </Link>
  );
}

export const SCAN_STATUS: Record<string, { label: string; dot: string }> = {
  complete: { label: "Complete", dot: "oklch(0.65 0.14 150)" },
  blocked: { label: "Blocked", dot: "oklch(0.72 0.14 75)" },
  failed: { label: "Failed", dot: "oklch(0.6 0.18 25)" },
  running: { label: "Running", dot: "oklch(0.62 0.14 250)" },
};

export function formatDate(d: Date | null | undefined): string {
  if (!d) return "Never";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
