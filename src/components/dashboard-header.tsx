import Link from "next/link";
import { PLAN_LABELS, type Plan } from "@/core/plan";
import { toggleDashboardTheme } from "@/app/dashboard/[slug]/theme-actions";

/** The sections a customer sees. Help and the Fact Sheet are links, not sections. */
type Section = "overview" | "answers" | "fixes" | "competitors" | "reports";
/** Older pages still name the section they used to be; each now lives inside one of the four. */
type Tab = Section | "accuracy" | "sources" | "report" | "help" | "facts";

const SECTION_OF: Record<Tab, Section | null> = {
  overview: "overview",
  answers: "answers",
  accuracy: "answers",
  fixes: "fixes",
  competitors: "competitors",
  sources: "competitors",
  reports: "reports",
  report: "reports",
  help: null,
  facts: null,
};

const TABS: { key: Section; label: string; suffix: string }[] = [
  { key: "overview", label: "Overview", suffix: "" },
  { key: "answers", label: "What AI says", suffix: "/answers" },
  { key: "fixes", label: "Wrong facts", suffix: "/fixes" },
  { key: "competitors", label: "Competitors", suffix: "/competitors" },
  { key: "reports", label: "Reports", suffix: "/reports" },
];

/**
 * The customer dashboard's header: the Mirror wordmark with the Fact Sheet
 * and Help links, the business name, then the sections as underlined
 * tabs.
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
    <header className="mb-8 print:hidden">
      <div className="flex items-baseline justify-between">
        <span className="display text-[22px] text-ink">Mirror</span>
        <div className="flex items-center gap-5">
          {[
            { key: "facts" as const, label: "Fact Sheet", suffix: "/fact-sheet" },
            { key: "help" as const, label: "Help", suffix: "/help" },
          ].map(link => (
            <Link
              key={link.key}
              href={`/dashboard/${slug}${link.suffix}`}
              aria-current={active === link.key ? "page" : undefined}
              className={`text-[14px] font-medium hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${active === link.key ? "text-ink" : "text-muted"}`}
            >
              {link.label}
            </Link>
          ))}
          {plan === "partner" && (
            <form action={toggleDashboardTheme} className="theme-toggle">
              <button type="submit" className="rounded-full border border-line px-3 py-1 text-[13px] font-medium text-muted hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
                <span className="to-light">Light look</span><span className="to-dark">Dark look</span>
              </button>
            </form>
          )}
          {plan && (
            <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${plan === "partner" ? "bg-gold text-paper" : "border border-line text-ink-soft"}`}>
              {PLAN_LABELS[plan]}
            </span>
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
      <nav className="-mx-1 mt-5 flex gap-6 overflow-x-auto border-b border-line px-1" aria-label="Dashboard sections">
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
