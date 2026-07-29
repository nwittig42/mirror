import Link from "next/link";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Mirror";

type Tab = "overview" | "answers" | "accuracy";

const TABS: { key: Tab; label: string; suffix: string }[] = [
  { key: "overview", label: "Overview", suffix: "" },
  { key: "answers", label: "Answers", suffix: "/answers" },
  { key: "accuracy", label: "Accuracy", suffix: "/accuracy" },
];

/** Shared header + tab nav for the three client dashboard pages. */
export function DashboardHeader({
  slug, practiceName, active,
}: {
  slug: string;
  practiceName: string;
  active: Tab;
}) {
  return (
    <header className="mb-8">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{appName}</p>
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">{practiceName}</h1>
      <nav className="mt-4 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map(tab => (
          <Link
            key={tab.key}
            href={`/dashboard/${slug}${tab.suffix}`}
            className={
              active === tab.key
                ? "border-b-2 border-black px-3 py-2 text-sm font-medium text-black dark:border-zinc-50 dark:text-zinc-50"
                : "border-b-2 border-transparent px-3 py-2 text-sm font-medium text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
            }
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
