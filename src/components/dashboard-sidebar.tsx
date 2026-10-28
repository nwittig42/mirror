"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PLAN_LABELS, type Plan } from "@/core/plan";

/** The plan one step up from this one: free goes to Pulse, Pulse to Partner, Partner has nowhere to go. */
export function nextPlan(plan: Plan | null): Plan | null {
  if (!plan) return "pulse";
  return plan === "pulse" ? "partner" : null;
}

/** Each link and the older pages that light it up. */
const GROUPS: { title: string; links: { label: string; suffix: string; also?: string[] }[] }[] = [
  {
    title: "What AI says",
    links: [
      { label: "Overview", suffix: "" },
      { label: "Answers", suffix: "/answers", also: ["/accuracy"] },
      { label: "Competitors", suffix: "/competitors", also: ["/sources"] },
    ],
  },
  {
    title: "Next steps",
    links: [
      { label: "Your plan", suffix: "/fixes" },
      { label: "Forecast", suffix: "/forecast" },
    ],
  },
];

const LINK = "block rounded-lg px-3 py-2 text-[14.5px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold";

/**
 * The dashboard's left sidebar (see the dashboard layout): the Mirror name,
 * two groups of pages, Reports, Pricing, and at the foot a button to the next
 * plan up. Below the lg breakpoint it folds into one row of links that scrolls
 * sideways, and the upgrade button is left to the pinned "Start your plan".
 */
export function DashboardSidebar({ slug, plan }: { slug: string; plan: Plan | null }) {
  const pathname = usePathname() ?? "";
  const base = `/dashboard/${slug}`;
  const isOn = (suffix: string, also: string[] = []) =>
    suffix === ""
      ? pathname === base
      : [suffix, ...also].some(s => pathname === base + s || pathname.startsWith(`${base}${s}/`));
  const item = (label: string, suffix: string, also?: string[]) => {
    const on = isOn(suffix, also);
    return (
      <Link key={suffix} href={base + suffix} aria-current={on ? "page" : undefined}
        className={`${LINK} whitespace-nowrap ${on ? "bg-bone text-ink" : "text-ink-soft hover:bg-bone/60 hover:text-ink"}`}>
        {label}
      </Link>
    );
  };
  const up = nextPlan(plan);

  return (
    <aside className="dash-sidebar print:hidden">
      <Link href="/" title="Back to the Mirror website"
        className="hidden px-3 pb-6 text-ink hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold lg:block">
        <span className="display text-[26px]">Mirror</span>
      </Link>
      <nav aria-label="Dashboard sections" className="dash-sidebar-nav">
        {GROUPS.map(group => (
          <div key={group.title} className="dash-sidebar-group">
            <p className="hidden px-3 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted lg:block">{group.title}</p>
            {group.links.map(l => item(l.label, l.suffix, l.also))}
          </div>
        ))}
        <div className="dash-sidebar-group">
          {item("Reports", "/reports", ["/report"])}
        </div>
        <div className="dash-sidebar-group lg:border-t lg:border-line lg:pt-4">
          {item("Pricing", "/plans")}
        </div>
      </nav>
      {up && (
        <Link href={`${base}/plans`}
          className="mt-auto hidden rounded-lg bg-ink px-4 py-3 text-center text-[15px] font-semibold text-ivory hover:bg-ink-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold lg:block">
          Upgrade to {PLAN_LABELS[up]}
        </Link>
      )}
    </aside>
  );
}
