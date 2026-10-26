import Link from "next/link";
import { PLAN_LABELS, type Plan } from "@/core/plan";
import { toggleDashboardTheme } from "@/app/dashboard/[slug]/theme-actions";
import { signOutToHome } from "@/app/dashboard/[slug]/account-actions";

/** The sections a customer sees. Help and the Fact Sheet are links, not sections. */
type Section = "overview" | "answers" | "fixes" | "competitors" | "forecast" | "reports";
/** Older pages still name the section they used to be; each now lives inside one of the four. */
type Tab = Section | "accuracy" | "sources" | "report" | "help" | "facts" | "settings";

const SECTION_OF: Record<Tab, Section | null> = {
  overview: "overview",
  answers: "answers",
  accuracy: "answers",
  fixes: "fixes",
  competitors: "competitors",
  sources: "competitors",
  forecast: "forecast",
  reports: "reports",
  report: "reports",
  help: null,
  facts: null,
  settings: null,
};

const TABS: { key: Section; label: string; suffix: string }[] = [
  { key: "overview", label: "Overview", suffix: "" },
  { key: "forecast", label: "Forecast", suffix: "/forecast" },
  { key: "answers", label: "What AI says", suffix: "/answers" },
  { key: "fixes", label: "Fix plan", suffix: "/fixes" },
  { key: "competitors", label: "Competitors", suffix: "/competitors" },
  { key: "reports", label: "Reports", suffix: "/reports" },
];

const MENU_ITEM = "block w-full rounded-lg px-3 py-2 text-left text-[14px] font-medium text-ink-soft hover:bg-bone hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold";

/**
 * The customer dashboard's header, across the full width of the window: at
 * the top left a way back to the Mirror website and the profile menu
 * (settings, Fact Sheet, Help, sign out); at the top right the plan; then
 * the business name and the sections as underlined tabs, from the left edge.
 */
export function DashboardHeader({
  slug, practiceName, logo, plan, active,
}: {
  slug: string;
  practiceName: string;
  /** The business's own logo as a `data:` address, when its website had one. */
  logo?: string | null;
  /** The business's plan, shown as a pill. Partner also gets the switch between the black and ivory looks. */
  plan?: Plan | null;
  active: Tab;
}) {
  const current = SECTION_OF[active];
  return (
    // Wider than the page under it: the header runs to both edges of the
    // window (the -translate trick breaks it out of PageBody's centred
    // column), so the name and the tabs sit at the far left while the cards
    // below stay centred.
    <header className="relative left-1/2 mb-8 w-screen -translate-x-1/2 px-4 sm:px-8 lg:px-12 print:hidden">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/" title="Back to the Mirror website"
            className="group flex items-center gap-3 text-ink hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink group-hover:border-gold">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12H5M11 5l-7 7 7 7" />
              </svg>
            </span>
            <span className="display text-[24px]">Mirror</span>
            <span className="sr-only">Back to the Mirror website</span>
          </Link>
          {/* A <details>, so the menu opens without any script and its links are in the page for everyone. */}
          <details className="profile-menu relative">
            <summary aria-label="Profile and settings"
              className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-line py-1 pl-1 pr-2.5 hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
              {logo ? (
                // A stored data: address, so next/image has nothing to optimize.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="h-7 w-7 rounded-full bg-white object-contain" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-ivory">{(practiceName.trim()[0] ?? "?").toUpperCase()}</span>
              )}
              <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3 fill-none stroke-muted" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
            </summary>
            <div className="absolute left-0 top-full z-40 mt-2 w-56 rounded-2xl border border-line bg-paper p-1.5 shadow-lg">
              <p className="truncate px-3 pb-1.5 pt-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">{practiceName}</p>
              {[
                { key: "settings" as const, label: "Profile and settings", suffix: "/settings" },
                { key: "facts" as const, label: "Fact Sheet", suffix: "/fact-sheet" },
                { key: "help" as const, label: "Help", suffix: "/help" },
              ].map(link => (
                <Link key={link.key} href={`/dashboard/${slug}${link.suffix}`} aria-current={active === link.key ? "page" : undefined}
                  className={`${MENU_ITEM} ${active === link.key ? "bg-bone text-ink" : ""}`}>
                  {link.label}
                </Link>
              ))}
              <div className="my-1.5 border-t border-line" />
              <Link href="/" className={MENU_ITEM}>← Back to Mirror home</Link>
              <form action={signOutToHome}><button type="submit" className={MENU_ITEM}>Sign out</button></form>
            </div>
          </details>
        </div>
        <div className="flex items-center gap-4">
          {plan === "partner" && (
            <form action={toggleDashboardTheme}>
              {/* Which side the knob sits on comes from the page's look (see .theme-switch in globals.css), so this needs no state. */}
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
          {plan === "partner" && (
            <span className="partner-pill">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.6 6.9 6.9 2.6-6.9 2.6L12 21.5l-2.6-6.9L2.5 12l6.9-2.6z" /></svg>
              {PLAN_LABELS.partner}
            </span>
          )}
          {plan && plan !== "partner" && (
            <span className="rounded-full border border-line px-3 py-1 text-[13px] font-semibold text-ink-soft">{PLAN_LABELS[plan]}</span>
          )}
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3.5">
        {logo && (
          // A stored data: address, so next/image has nothing to optimize.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-11 w-11 shrink-0 rounded-[12px] border border-line bg-white object-contain" />
        )}
        <h1 className="text-[34px] font-semibold leading-tight tracking-tight text-ink">{practiceName}</h1>
      </div>
      <nav className="mt-5 flex gap-7 overflow-x-auto border-b border-line" aria-label="Dashboard sections">
        {TABS.map(tab => (
          <Link
            key={tab.key}
            href={`/dashboard/${slug}${tab.suffix}`}
            aria-current={current === tab.key ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-[15px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
              current === tab.key ? "border-gold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
