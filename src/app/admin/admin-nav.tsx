"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TAB_ROW, tabClass } from "@/app/admin/ui";

const TABS = [
  { href: "/admin", label: "Customers", match: (p: string) => p === "/admin" || p.startsWith("/admin/practices") },
  { href: "/admin/support", label: "Support", match: (p: string) => p.startsWith("/admin/support") },
  { href: "/admin/ask", label: "Ask AI live", match: (p: string) => p.startsWith("/admin/ask") },
  { href: "/admin/report-preview", label: "Report preview", match: (p: string) => p.startsWith("/admin/report-preview") },
];

/** The tab row in the admin header. Client-side only to know which tab is open. */
export function AdminNav({ openSupport }: { openSupport: number }) {
  const path = usePathname() ?? "/admin";
  return (
    <nav className={`mt-5 ${TAB_ROW}`} aria-label="Admin sections">
      {TABS.map(t => {
        const active = t.match(path);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
            {t.label}
            {t.href === "/admin/support" && openSupport > 0 && (
              <span className="ml-1.5 rounded-full bg-gold-soft px-2 py-0.5 text-[12px] font-semibold text-gold">
                {openSupport}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
