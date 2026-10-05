import type { ReactNode } from "react";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { supportRequests } from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import { AdminNav } from "./admin-nav";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Mirror";

/**
 * The top bar on every admin page: the app name, the operator's email and a
 * tab for each admin area. Also the operator gate for everything under
 * /admin: a customer gets a not-found page before anything renders.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const operator = await requireOperator();
  const open = await getDb().select({ id: supportRequests.id }).from(supportRequests)
    .where(eq(supportRequests.status, "open"));
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-[#e4e4e7] bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[1000px] flex-wrap items-end justify-between gap-x-6 px-5 pt-3">
          <div className="flex items-baseline gap-2 pb-3">
            <Link href="/admin" className="text-[15px] font-bold text-black">{appName}</Link>
            <span className="text-[13px] text-zinc-500">Admin</span>
          </div>
          <AdminNav openSupport={open.length} />
          <div className="hidden pb-3 text-[13px] text-zinc-500 sm:block">{operator.email}</div>
        </div>
      </header>
      {children}
    </div>
  );
}
