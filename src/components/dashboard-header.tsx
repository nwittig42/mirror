import Link from "next/link";

type Tab = "overview" | "answers" | "competitors" | "sources" | "accuracy" | "reports" | "report" | "help";

const TABS: { key: Tab; label: string; suffix: string }[] = [
  { key: "overview", label: "Summary", suffix: "" },
  { key: "answers", label: "Answers", suffix: "/answers" },
  { key: "competitors", label: "Competitors", suffix: "/competitors" },
  { key: "sources", label: "Sources", suffix: "/sources" },
  { key: "accuracy", label: "Accuracy", suffix: "/accuracy" },
  { key: "reports", label: "Reports", suffix: "/reports" },
  { key: "report", label: "Monthly report", suffix: "/report" },
  { key: "help", label: "Help", suffix: "/help" },
];

/**
 * The customer dashboard's header, after Apple Fitness: today's date in grey,
 * a large bold title, and the sections as pills.
 */
export function DashboardHeader({
  slug, practiceName, active,
}: {
  slug: string;
  practiceName: string;
  active: Tab;
}) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <header className="mb-6">
      <p className="text-[13px] font-semibold text-[#8e8e93]">{today}</p>
      <h1 className="text-[34px] font-bold leading-tight tracking-tight text-white">{practiceName}</h1>
      <nav className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 print:hidden" aria-label="Dashboard sections">
        {TABS.map(tab => (
          <Link
            key={tab.key}
            href={`/dashboard/${slug}${tab.suffix}`}
            aria-current={active === tab.key ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-[15px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
              active === tab.key ? "bg-white text-black" : "bg-[#1c1c1e] text-[#aeaeb2] hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
