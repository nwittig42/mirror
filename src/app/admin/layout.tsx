import type { ReactNode } from "react";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { supportRequests } from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import { AdminNav } from "./admin-nav";
import { ADMIN_WIDTH } from "./ui";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Mirror";

/**
 * The header on every admin page, in the same look as the customer dashboard
 * (the .app class in globals.css): the wordmark, the operator's email and a
 * tab for each admin area. Also the operator gate for everything under
 * /admin: a customer gets a not-found page before anything renders.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const operator = await requireOperator();
  const open = await getDb().select({ id: supportRequests.id }).from(supportRequests)
    .where(eq(supportRequests.status, "open"));
  return (
    <div className="app antialiased">
      <header className={`${ADMIN_WIDTH} pt-8 print:hidden`}>
        <div className="flex items-baseline justify-between gap-4">
          <Link href="/admin" className="flex items-baseline gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
            <span className="display text-[22px] text-ink">{appName}</span>
            <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Admin</span>
          </Link>
          <span className="hidden truncate text-[14px] text-muted sm:block">{operator.email}</span>
        </div>
        <AdminNav openSupport={open.length} />
      </header>
      {children}
    </div>
  );
}
