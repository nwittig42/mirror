import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { practices, supportRequests } from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import { setSupportRequestStatus } from "@/app/admin/actions";
import { SUPPORT_TOPICS, type SupportTopic } from "@/services/support";

async function handleSupportStatus(id: string, status: "open" | "closed"): Promise<void> {
  "use server";
  await setSupportRequestStatus(id, status);
}

const RECENTLY_CLOSED = 10;

/** Support rows with their age in hours, for the "reply within a business day" flag. */
async function loadSupportQueue(db: ReturnType<typeof getDb>) {
  const rows = await db.select({
    id: supportRequests.id, email: supportRequests.email, topic: supportRequests.topic,
    message: supportRequests.message, status: supportRequests.status, createdAt: supportRequests.createdAt,
    practiceId: practices.id, practiceName: practices.name,
  })
    .from(supportRequests)
    .innerJoin(practices, eq(supportRequests.practiceId, practices.id))
    .orderBy(desc(supportRequests.createdAt))
    .limit(100);
  const now = Date.now();
  return rows.map(r => ({ ...r, ageHours: Math.floor((now - r.createdAt.getTime()) / 3_600_000) }));
}

export default async function SupportPage() {
  await requireOperator();
  const supportRows = await loadSupportQueue(getDb());
  const openSupport = supportRows.filter(r => r.status === "open");
  const closedSupport = supportRows.filter(r => r.status === "closed").slice(0, RECENTLY_CLOSED);

  return (
    <div className="mx-auto max-w-[1000px] px-5 pb-20 pt-10">
      <h1 className="mb-1 text-[26px] font-bold tracking-tight text-black">Support</h1>
      <section id="support">
        <h2 className="mb-1 text-sm font-medium text-black dark:text-zinc-50">
          Support requests {openSupport.length > 0 && <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800 dark:bg-red-950 dark:text-red-300">{openSupport.length} open</span>}
        </h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          From the client dashboard&apos;s Help tab. We promise a reply within one business day: answer by email, then close it here.
        </p>
        {openSupport.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Nothing waiting.</p>
        ) : (
          <ul className="space-y-3">
            {openSupport.map(r => (
              <li key={r.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span>
                    <Link href={`/admin/practices/${r.practiceId}/overview`} className="font-medium text-black underline-offset-2 hover:underline dark:text-zinc-50">
                      {r.practiceName}
                    </Link>
                    <span className="text-zinc-500 dark:text-zinc-400"> · {SUPPORT_TOPICS[r.topic as SupportTopic] ?? r.topic} · </span>
                    <a href={`mailto:${r.email}`} className="text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400">{r.email}</a>
                  </span>
                  <span className={`text-xs ${r.ageHours >= 24 ? "font-medium text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}>
                    {r.ageHours < 1 ? "just now" : `${r.ageHours}h ago`}
                  </span>
                </div>
                <p className="mb-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{r.message}</p>
                <form action={handleSupportStatus.bind(null, r.id, "closed")}>
                  <button type="submit" className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-black hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900">
                    Mark answered
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {closedSupport.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-zinc-500 dark:text-zinc-400">Recently answered ({closedSupport.length})</summary>
            <ul className="mt-2 space-y-2">
              {closedSupport.map(r => (
                <li key={r.id} className="flex items-baseline justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="truncate">{r.practiceName} · {r.message}</span>
                  <form action={handleSupportStatus.bind(null, r.id, "open")}>
                    <button type="submit" className="text-xs underline-offset-2 hover:underline">Reopen</button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

    </div>
  );
}
