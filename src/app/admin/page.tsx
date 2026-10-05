import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { supportRequests } from "@/db/schema";
import { ScoreRings } from "@/components/score-rings";
import { listPracticeRows } from "@/lib/admin-queries";
import { listLeads } from "@/services/leads";
import { Pill, PrimaryLink, SecondaryLink, SCAN_STATUS, formatDate, type Tone } from "@/app/admin/ui";

const LEAD_STATUS: Record<string, { label: string; tone: Tone }> = {
  preparing: { label: "Preparing report…", tone: "blue" },
  ready: { label: "Report ready", tone: "green" },
  needs_attention: { label: "Needs a look", tone: "amber" },
};
import { requireOperator } from "@/lib/auth";
import { createPractice } from "@/app/admin/actions";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Mirror";

// A server action invoked from a page runs under that *page's* route
// segment config, not the action module's, so `triggerScan`'s ~2-minute
// after() scan needs whichever admin page called it to allow enough
// duration, same as `src/app/admin/practices/[id]/page.tsx` (the page that
// actually renders the "Run scan now" form). Set here too so this rule
// holds regardless of which admin page ends up invoking scan actions.
// Mirrors the cron route's identical setting
// (`src/app/api/cron/weekly-scan/route.ts`). 800s requires a paid Vercel
// plan (see README ship checklist).
export const maxDuration = 800;

async function handleCreatePractice(formData: FormData): Promise<void> {
  "use server";
  const name = formData.get("name");
  const slug = formData.get("slug");
  const website = formData.get("website");
  if (typeof name !== "string" || typeof slug !== "string" || !name.trim() || !slug.trim()) return;
  await createPractice({
    name: name.trim(),
    slug: slug.trim(),
    website: typeof website === "string" && website.trim() ? website.trim() : undefined,
  });
}

export default async function AdminPage() {
  await requireOperator();
  const db = getDb();
  const [practiceRows, leadRows, openSupport] = await Promise.all([
    listPracticeRows(db),
    listLeads(db, 10),
    db.select({ id: supportRequests.id }).from(supportRequests).where(eq(supportRequests.status, "open")),
  ]);

  return (
    <div className="mx-auto max-w-[1000px] px-5 pb-20 pt-10">
      <header className="mb-8">
        <h1 className="text-[26px] font-bold tracking-tight text-black dark:text-zinc-50">Customers</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Every practice {appName} monitors. Open one to see everything about it, or view its dashboard as the customer sees it.
        </p>
        {openSupport.length > 0 && (
          <Link href="/admin/support" className="mt-3 inline-block rounded-md px-3 py-2 text-[13px] font-medium"
            style={{ background: "oklch(0.95 0.05 60)", color: "oklch(0.42 0.13 60)" }}>
            {openSupport.length} support request{openSupport.length === 1 ? "" : "s"} waiting →
          </Link>
        )}
      </header>

      {leadRows.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-1 text-sm font-medium text-black dark:text-zinc-50">New leads</h2>
          <p className="mb-3 text-xs text-zinc-500">
            From the booking form. Each one gets an account, a fact sheet and questions drafted from their website, and a
            first scan, automatically. Review the report before the call.
          </p>
          <div className="text-sm">
            {leadRows.map(l => {
              const st = LEAD_STATUS[l.status] ?? LEAD_STATUS.preparing;
              return (
                <div key={l.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e4e4e7] py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-black">{l.practiceName}</span>
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </div>
                    <div className="text-[13px] text-zinc-500">
                      {l.contactName} · <a href={`mailto:${l.email}`} className="hover:underline">{l.email}</a>
                      {l.phone ? ` · ${l.phone}` : ""} · {l.websiteUrl} · booked {formatDate(l.createdAt)}
                    </div>
                    {l.bestTimes && <div className="text-[13px] text-zinc-500">Best times: {l.bestTimes}</div>}
                    {l.note && <div className="mt-1 text-[13px] text-amber-800">{l.note}</div>}
                  </div>
                  {l.practiceId && (
                    <div className="flex gap-2">
                      <PrimaryLink href={`/admin/practices/${l.practiceId}/overview?tab=reports`}>See report</PrimaryLink>
                      <SecondaryLink href={`/admin/practices/${l.practiceId}`}>Edit setup</SecondaryLink>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <details className="group mb-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-black dark:text-zinc-50">Practices</h2>
            <span className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-[13px] font-medium text-black hover:border-zinc-500">
              + Add a practice
            </span>
          </summary>
          <div className="mt-3 rounded-[10px] border border-zinc-200 p-4 dark:border-zinc-800">
            <form action={handleCreatePractice} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                name="name"
                required
                placeholder="Practice name"
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <input
                name="slug"
                required
                placeholder="slug"
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <input
                name="website"
                type="url"
                placeholder="https://example.com (optional)"
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <button
                type="submit"
                className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 sm:col-span-3 sm:w-fit dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                Create practice
              </button>
            </form>
          </div>
        </details>

        {practiceRows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No practices yet.</p>
        ) : (
          <div className="text-sm">
            <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_240px] gap-4 border-b border-[#e4e4e7] pb-2 text-[13px] text-zinc-500 sm:grid">
              <div>Name</div><div>Latest score</div><div>Last scan</div><div className="text-right">Open</div>
            </div>
            {practiceRows.map(r => (
              <div key={r.id} className="grid grid-cols-1 gap-2 border-b border-[#e4e4e7] py-3.5 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_240px] sm:items-center sm:gap-4">
                <div className="min-w-0">
                  <Link href={`/admin/practices/${r.id}/overview`} className="font-semibold text-black underline-offset-2 hover:underline dark:text-zinc-50">
                    {r.name}
                  </Link>
                  <div className="truncate text-[13px] text-zinc-500">
                    {r.website ?? "No website"} · {r.active ? "Active" : "Paused"}
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <ScoreRings scores={{ overall: r.overall, visibility: r.visibility, facts: r.facts }} size={40} />
                  {r.overall === null
                    ? <span className="text-zinc-500">No score yet</span>
                    : <span><span className="font-semibold text-black dark:text-zinc-50">{r.overall}</span><span className="text-zinc-500"> / 100</span></span>}
                </div>
                <div className="text-zinc-600 dark:text-zinc-400">
                  {formatDate(r.lastScanAt)}
                  {r.lastScanStatus && r.lastScanStatus !== "complete" && (
                    <span className="ml-1 text-xs text-zinc-500">({SCAN_STATUS[r.lastScanStatus]?.label.toLowerCase()})</span>
                  )}
                </div>
                <div className="flex gap-2 sm:justify-end">
                  <PrimaryLink href={`/admin/practices/${r.id}/overview`}>Overview</PrimaryLink>
                  <SecondaryLink href={`/dashboard/${r.slug}`}>View as customer</SecondaryLink>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
