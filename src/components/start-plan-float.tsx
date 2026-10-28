"use client";

import { usePathname } from "next/navigation";

/**
 * The button pinned to the bottom left of every page of a free account's
 * dashboard (see the dashboard layout): one tap to the plans page. Left off
 * the plans page itself, where it would cover the plans. Phones and tablets
 * only: on a wide screen the sidebar has its own upgrade button.
 */
export function StartPlanFloat({ slug }: { slug: string }) {
  const href = `/dashboard/${slug}/plans`;
  if (usePathname() === href) return null;
  return (
    <a href={href}
      className="fixed bottom-5 left-5 lg:hidden z-50 inline-flex items-center gap-2.5 rounded-full bg-ink py-3 pl-4 pr-5 text-[15px] font-semibold text-ivory shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold print:hidden">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-[13px] text-paper" aria-hidden="true">↑</span>
      Start your plan
      <span className="text-[13px] font-medium text-ivory/70">First month free</span>
    </a>
  );
}
