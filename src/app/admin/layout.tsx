import type { ReactNode } from "react";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { supportRequests } from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import { AdminNav } from "./admin-nav";
import { ADMIN_WIDTH } from "./ui";
import { signOutToHome } from "@/app/dashboard/[slug]/account-actions";

const MENU_ITEM = "block w-full rounded-lg px-3 py-2 text-left text-[14px] font-medium text-ink-soft hover:bg-bone hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Mirror";

/**
 * The header on every admin page, in the same look as the customer dashboard
 * (the .app class in globals.css): the Mirror mark, which opens a menu with
 * the operator's email and Log out, the wordmark, and a tab for each admin
 * area. Also the operator gate for everything under
 * /admin: a customer gets a not-found page before anything renders.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const operator = await requireOperator();
  const open = await getDb().select({ id: supportRequests.id }).from(supportRequests)
    .where(eq(supportRequests.status, "open"));
  return (
    <div className="app antialiased">
      <header className={`${ADMIN_WIDTH} pt-8 print:hidden`}>
        <div className="flex items-center gap-3">
          {/* A <details>, so the menu opens without any script. */}
          <details className="relative">
            <summary aria-label="Account menu"
              className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-line py-1 pl-1 pr-2.5 hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
              {/* The Mirror mark, the same one the browser tab shows. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.svg" alt="" className="h-8 w-8 rounded-full" />
              <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3 fill-none stroke-muted" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
            </summary>
            <div className="absolute left-0 top-full z-40 mt-2 w-60 rounded-2xl border border-line bg-paper p-1.5 shadow-lg">
              <p className="truncate px-3 pb-1.5 pt-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">Signed in as</p>
              <p className="truncate px-3 pb-2 text-[14px] text-ink">{operator.email}</p>
              <div className="my-1.5 border-t border-line" />
              <Link href="/" className={MENU_ITEM}>← Back to the Mirror website</Link>
              <Link href="/change-password" className={MENU_ITEM}>Change password</Link>
              <form action={signOutToHome}><button type="submit" className={MENU_ITEM}>Log out</button></form>
            </div>
          </details>
          <Link href="/admin" className="flex items-baseline gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
            <span className="display text-[22px] text-ink">{appName}</span>
            <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Admin</span>
          </Link>
        </div>
        <AdminNav openSupport={open.length} />
      </header>
      {children}
    </div>
  );
}
