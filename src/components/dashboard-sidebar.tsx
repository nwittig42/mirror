"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PLAN_LABELS, type Plan } from "@/core/plan";
import { toggleDashboardTheme } from "@/app/dashboard/[slug]/theme-actions";
import { signOutToHome } from "@/app/dashboard/[slug]/account-actions";

/** The plan one step up from this one: free goes to Pulse, Pulse to Partner, Partner has nowhere to go. */
export function nextPlan(plan: Plan | null): Plan | null {
  if (!plan) return "pulse";
  return plan === "pulse" ? "partner" : null;
}

/** 16px line icons, drawn in the text colour. */
const ICONS: Record<string, ReactNode> = {
  overview: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  answers: <path d="M4 5.5h16v10H9l-5 4z" />,
  competitors: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.8c1.6.7 2.6 2.4 3 4.7" /></>,
  plan: <><path d="M9 6.5h11M9 12h11M9 17.5h11" /><path d="M3.8 6.5l1.2 1.2 2-2.2M3.8 12l1.2 1.2 2-2.2M3.8 17.5l1.2 1.2 2-2.2" /></>,
  forecast: <><path d="M3.5 19.5h17" /><path d="M5 15l4.5-4.5 3.5 3 6-6.5" /><path d="M15 7h4v4" /></>,
  reports: <><path d="M6.5 3.5h7l4 4v13h-11z" /><path d="M13.5 3.5v4h4M9 12.5h6M9 16h6" /></>,
  pricing: <><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7z" /><circle cx="8" cy="8" r="1.4" /></>,
};

const GROUPS: { title: string; links: { label: string; suffix: string; icon: string; also?: string[] }[] }[] = [
  {
    title: "What AI says",
    links: [
      { label: "Overview", suffix: "", icon: "overview" },
      { label: "Answers", suffix: "/answers", icon: "answers", also: ["/accuracy"] },
      { label: "Competitors", suffix: "/competitors", icon: "competitors", also: ["/sources"] },
    ],
  },
  {
    title: "Next steps",
    links: [
      { label: "Your plan", suffix: "/fixes", icon: "plan" },
      { label: "Forecast", suffix: "/forecast", icon: "forecast" },
    ],
  },
];

const RESOURCES = [
  { label: "Reports", suffix: "/reports", icon: "reports", also: ["/report"] },
  { label: "Pricing", suffix: "/plans", icon: "pricing" },
];

const MENU_ITEM = "block w-full rounded-lg px-3 py-2 text-left text-[14px] font-medium text-ink-soft hover:bg-bone hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold";

/**
 * The dashboard's left sidebar (see the dashboard layout). On a wide screen:
 * the business at the top, opening the account menu; the pages in two groups
 * with icons; Reports and Pricing near the foot; and a box with the plan and
 * a button to the next plan up. Below the lg breakpoint only the links show,
 * as one row that scrolls sideways, and the page's header carries the account.
 */
export function DashboardSidebar({ slug, practiceName, logo, plan }: {
  slug: string;
  practiceName: string;
  /** The business's own logo as a `data:` address, when its website had one. */
  logo?: string | null;
  plan: Plan | null;
}) {
  const pathname = usePathname() ?? "";
  const base = `/dashboard/${slug}`;
  const isOn = (suffix: string, also: string[] = []) =>
    suffix === ""
      ? pathname === base
      : [suffix, ...also].some(s => pathname === base + s || pathname.startsWith(`${base}${s}/`));
  const item = (l: { label: string; suffix: string; icon: string; also?: string[] }) => {
    const on = isOn(l.suffix, l.also);
    return (
      <Link key={l.suffix} href={base + l.suffix} aria-current={on ? "page" : undefined}
        className={`dash-link ${on ? "bg-bone font-semibold text-ink" : "text-ink-soft hover:bg-bone/60 hover:text-ink"}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="hidden h-4 w-4 shrink-0 fill-none stroke-current lg:block" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">{ICONS[l.icon]}</svg>
        {l.label}
      </Link>
    );
  };
  const up = nextPlan(plan);
  const menuLinks = [
    { label: "Profile and settings", suffix: "/settings" },
    { label: plan ? "Your plan" : "Plans and pricing", suffix: "/plans" },
    { label: "Fact Sheet", suffix: "/fact-sheet" },
    { label: "Help", suffix: "/help" },
  ];

  return (
    <aside className="dash-sidebar print:hidden">
      {/* A <details>, so the menu opens without any script. */}
      <details className="profile-menu relative mb-5 hidden border-b border-line pb-3 lg:block">
        <summary aria-label="Account and settings"
          className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-bone/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
          {logo ? (
            // A stored data: address, so next/image has nothing to optimize.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-7 w-7 shrink-0 rounded-md border border-line bg-white object-contain" />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink text-[13px] font-semibold text-ivory">{(practiceName.trim()[0] ?? "?").toUpperCase()}</span>
          )}
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{practiceName}</span>
          <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3 shrink-0 fill-none stroke-muted" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
        </summary>
        <div className="absolute left-0 right-0 top-full z-40 mt-1.5 rounded-2xl border border-line bg-paper p-1.5 shadow-lg">
          {menuLinks.map(l => (
            <Link key={l.suffix} href={base + l.suffix} className={`${MENU_ITEM} ${pathname === base + l.suffix ? "bg-bone text-ink" : ""}`}>{l.label}</Link>
          ))}
          <div className="my-1.5 border-t border-line" />
          <Link href="/" className={MENU_ITEM}>← Back to Mirror home</Link>
          <form action={signOutToHome}><button type="submit" className={MENU_ITEM}>Sign out</button></form>
        </div>
      </details>

      <nav aria-label="Dashboard sections" className="dash-sidebar-nav">
        {GROUPS.map(group => (
          <div key={group.title} className="dash-sidebar-group">
            <p className="dash-group-title">{group.title}</p>
            {group.links.map(item)}
          </div>
        ))}
        <div className="dash-sidebar-group lg:mt-auto">
          <p className="dash-group-title">Resources</p>
          {RESOURCES.map(item)}
        </div>
      </nav>

      <div className="mt-4 hidden rounded-[10px] border border-line p-3.5 lg:block">
        <p className="text-[13px] font-semibold text-ink">{plan ? `${PLAN_LABELS[plan]} plan` : "Free audit"}</p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
          {plan ? "AI checked every week." : "One scan. A plan rescans every week."}
        </p>
        {up && (
          <Link href={`${base}/plans`}
            className="btn-gold mt-3 block rounded-lg px-3 py-2.5 text-center text-[13.5px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
            Upgrade to {PLAN_LABELS[up]}
          </Link>
        )}
        {plan === "partner" && (
          <form action={toggleDashboardTheme} className="mt-3 flex items-center justify-between">
            <span className="text-[12.5px] text-muted">Dark or light</span>
            {/* Which side the knob sits on comes from the page's look (see .theme-switch in globals.css). */}
            <button type="submit" className="theme-switch" aria-label="Switch between the dark and the light look" title="Dark or light look">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-switch-sun">
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
              </svg>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-switch-moon">
                <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
              </svg>
              <span className="theme-switch-knob" />
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
