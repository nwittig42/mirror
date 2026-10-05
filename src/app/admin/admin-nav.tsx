"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACCENT, ACCENT_TEXT } from "@/app/admin/ui";

const TABS = [
  { href: "/admin", label: "Customers", match: (p: string) => p === "/admin" || p.startsWith("/admin/practices") },
  { href: "/admin/support", label: "Support", match: (p: string) => p.startsWith("/admin/support") },
  { href: "/admin/ask", label: "Ask AI live", match: (p: string) => p.startsWith("/admin/ask") },
  { href: "/admin/report-preview", label: "Report preview", match: (p: string) => p.startsWith("/admin/report-preview") },
];

/** The tab row in the admin top bar. Client-side only to know which tab is open. */
export function AdminNav({ openSupport }: { openSupport: number }) {
  const path = usePathname() ?? "/admin";
  return (
    <nav className="-mb-px flex overflow-x-auto">
      {TABS.map(t => {
        const active = t.match(path);
        return (
          <Link key={t.href} href={t.href}
            className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm ${active ? "font-semibold" : "border-transparent text-[#555] hover:text-black"}`}
            style={active ? { borderColor: ACCENT, color: ACCENT_TEXT } : undefined}>
            {t.label}
            {t.href === "/admin/support" && openSupport > 0 && (
              <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold"
                style={{ background: "oklch(0.95 0.05 60)", color: "oklch(0.42 0.13 60)" }}>
                {openSupport}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
