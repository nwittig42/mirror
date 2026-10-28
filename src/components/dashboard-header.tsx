import Link from "next/link";
import { PLAN_LABELS, type Plan } from "@/core/plan";
import { PageTitle } from "@/components/ui";
import { toggleDashboardTheme } from "@/app/dashboard/[slug]/theme-actions";
import { signOutToHome } from "@/app/dashboard/[slug]/account-actions";

/** The page being shown. The sections themselves are links in the sidebar (see DashboardSidebar). */
type Tab = "overview" | "answers" | "fixes" | "competitors" | "forecast" | "reports"
  | "accuracy" | "sources" | "report" | "help" | "facts" | "settings" | "plans";

/** Each page's title and the line under it. Pages that write their own title (Next steps, Plans, the Fact Sheet, a month's report) have none. */
const TITLES: Partial<Record<Tab, { title: string; sub: string }>> = {
  overview: { title: "Overview", sub: "How AI sees your business, in three scores." },
  answers: { title: "What AI says", sub: "Every answer from your latest scan, AI tool by AI tool." },
  accuracy: { title: "What AI says", sub: "What AI gets right and wrong about you." },
  competitors: { title: "Competitors", sub: "Who AI recommends when buyers ask, and where you rank." },
  sources: { title: "Sources", sub: "The websites AI reads before it answers." },
  forecast: { title: "Forecast", sub: "Where your next steps could take you." },
  reports: { title: "Reports", sub: "Your audit as pages to read, print or share." },
  settings: { title: "Settings", sub: "Your business, your account and your plan." },
  help: { title: "Help", sub: "Answers to common questions, and a way to reach us." },
};

const MENU_ITEM = "block w-full rounded-lg px-3 py-2 text-left text-[14px] font-medium text-ink-soft hover:bg-bone hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold";

/**
 * The top of every customer dashboard page. On phones and tablets: a way back
 * to the Mirror website, the profile menu (settings, Fact Sheet, Help, sign
 * out), the plan and the business name; on a wide screen the sidebar carries
 * all of that (see DashboardSidebar). Then, on every screen, the page's title
 * (see TITLES) under the business's name.
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
  const heading = TITLES[active];
  return (
    <>
    <header className="mb-8 border-b border-line pb-6 lg:hidden print:hidden">
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
                { key: "plans" as const, label: plan ? "Your plan" : "Plans and pricing", suffix: "/plans" },
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
          {!plan && (
            <Link href={`/dashboard/${slug}/plans`}
              className="flex items-center gap-2 rounded-full border border-line py-1 pl-3 pr-1 text-[13px] font-semibold text-ink-soft hover:border-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
              Free audit
              <span className="rounded-full bg-gold px-2.5 py-0.5 text-paper">Upgrade</span>
            </Link>
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
    </header>
    {heading && <PageTitle eyebrow={practiceName} title={heading.title}>{heading.sub}</PageTitle>}
    </>
  );
}
