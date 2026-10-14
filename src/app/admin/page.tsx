import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { supportRequests } from "@/db/schema";
import { Card, Note, PageBody, Tag, type Tone } from "@/components/ui";
import { requireOperator } from "@/lib/auth";
import { createPractice } from "@/app/admin/actions";
import { listPracticeRows } from "@/lib/admin-queries";
import { listLeads } from "@/services/leads";
import {
  Button, Empty, PageTitle, PrimaryLink, SecondaryLink, SCAN_STATUS, TextInput, actionClass, formatDate, linkClass,
} from "@/app/admin/ui";

const LEAD_STATUS: Record<string, { label: string; tone: Tone }> = {
  preparing: { label: "Preparing report", tone: "neutral" },
  ready: { label: "Report ready", tone: "ok" },
  needs_attention: { label: "Needs a look", tone: "gold" },
};

// A server action invoked from a page runs under that *page's* route
// segment config, not the action module's, so `triggerScan`'s ~2-minute
// after() scan needs whichever admin page called it to allow enough
// duration, same as `src/app/admin/practices/[id]/page.tsx` (the page that
// actually renders the "Run scan now" form). Set here too so this rule
// holds regardless of which admin page ends up invoking scan actions.
// Mirrors the cron route's identical setting
// (`src/app/api/cron/weekly-scan/route.ts`). 800s requires a paid Vercel
// plan (see README ship checklist).
// 300 is the most the Vercel Hobby plan allows; a Pro plan allows up to 800.
export const maxDuration = 300;

async function handleCreatePractice(formData: FormData): Promise<void> {
  "use server";
  const name = formData.get("name");
  const slug = formData.get("slug");
  const optional = (field: string) => {
    const raw = formData.get(field);
    return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
  };
  if (typeof name !== "string" || typeof slug !== "string" || !name.trim() || !slug.trim()) return;
  await createPractice({
    name: name.trim(),
    slug: slug.trim(),
    website: optional("website"),
    category: optional("category"),
    location: optional("location"),
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

  const cols = "sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto]";

  return (
    <PageBody wide>
      <PageTitle title="Customers">
        Every business we watch. Open one to see everything about it, or see its dashboard the way the customer does.
      </PageTitle>
      {openSupport.length > 0 && (
        <Link href="/admin/support" className="mb-6 inline-block rounded-full bg-gold-soft px-4 py-2 text-[14px] font-semibold text-ink hover:brightness-95">
          {openSupport.length} support request{openSupport.length === 1 ? "" : "s"} waiting →
        </Link>
      )}

      <div className="space-y-4">
        {leadRows.length > 0 && (
          <Card title="New leads">
            <Note>
              From the booking form. Each one gets an account, a first fact sheet, questions and a first scan on its
              own. Read the report before the call.
            </Note>
            <ul className="mt-3 divide-y divide-line">
              {leadRows.map(l => {
                const st = LEAD_STATUS[l.status] ?? LEAD_STATUS.preparing;
                return (
                  <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold text-ink">{l.practiceName}</span>
                        <Tag tone={st.tone}>{st.label}</Tag>
                      </div>
                      {(l.category || l.location) && (
                        <div className="text-[14px] text-ink-soft">{[l.category, l.location].filter(Boolean).join(" · ")}</div>
                      )}
                      <div className="break-words text-[13px] text-muted">
                        {l.contactName} · <a href={`mailto:${l.email}`} className="hover:text-gold hover:underline">{l.email}</a>
                        {l.phone ? ` · ${l.phone}` : ""} · {l.websiteUrl} · booked {formatDate(l.createdAt)}
                      </div>
                      {l.bestTimes && <div className="text-[13px] text-muted">Best times: {l.bestTimes}</div>}
                      {l.note && <div className="mt-1 text-[13px] font-medium text-gold">{l.note}</div>}
                    </div>
                    {l.practiceId && (
                      <div className="flex gap-2">
                        <PrimaryLink href={`/admin/practices/${l.practiceId}/overview?tab=reports`}>See report</PrimaryLink>
                        <SecondaryLink href={`/admin/practices/${l.practiceId}`}>Edit setup</SecondaryLink>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <Card title="Businesses">
          <details className="mb-2">
            <summary className={`${actionClass("outline", "sm")} cursor-pointer list-none`}>Add a business</summary>
            <form action={handleCreatePractice} className="mt-4 grid grid-cols-1 gap-3 rounded-2xl bg-ivory p-4 sm:grid-cols-3">
              <TextInput name="name" required placeholder="Business name" aria-label="Business name" />
              <TextInput name="slug" required placeholder="Short name for the web address" aria-label="Short name for the web address" />
              <TextInput name="website" type="url" placeholder="https://example.com (optional)" aria-label="Website" />
              {/* Same caps as the business page's "Report details" form. A
                  location is what lets the namesake guard tell this business
                  from one with the same name somewhere else. */}
              <TextInput name="category" maxLength={60} placeholder="Kind of business, e.g. Plumber (optional)" aria-label="Kind of business" />
              <TextInput name="location" maxLength={80} placeholder="City or area, e.g. Portland, OR (optional)" aria-label="City or area" />
              <Button className="sm:w-fit">Create business</Button>
            </form>
          </details>

          {practiceRows.length === 0 ? <Empty>No businesses yet.</Empty> : (
            <div>
              <div className={`hidden gap-4 border-b border-line pb-2 text-[13px] font-semibold text-muted sm:grid ${cols}`}>
                <div>Name</div><div>Latest score</div><div>Last scan</div><div className="w-[250px] text-right">Open</div>
              </div>
              {practiceRows.map(r => (
                <div key={r.id} className={`grid grid-cols-1 gap-2 border-b border-line py-3.5 last:border-b-0 sm:items-center sm:gap-4 ${cols}`}>
                  <div className="min-w-0">
                    <Link href={`/admin/practices/${r.id}/overview`} className={`text-[15px] ${linkClass}`}>{r.name}</Link>
                    <div className="truncate text-[13px] text-muted">
                      {r.website ?? "No website"} · {r.active ? "Active" : "Paused"}
                    </div>
                  </div>
                  <div>
                    {r.overall === null ? <span className="text-[14px] text-muted">No score yet</span> : (
                      <>
                        <div className="text-[15px]">
                          <span className="font-semibold text-ink">{r.overall}</span><span className="text-muted"> / 100 overall</span>
                        </div>
                        <div className="text-[13px] text-muted">
                          Recommended by AI {r.visibility ?? "N/A"} · Accuracy {r.facts ?? "N/A"}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="text-[14px] text-ink-soft">
                    {formatDate(r.lastScanAt)}
                    {r.lastScanStatus && r.lastScanStatus !== "complete" && (
                      <span className="ml-1 text-[13px] text-muted">({SCAN_STATUS[r.lastScanStatus]?.label.toLowerCase()})</span>
                    )}
                  </div>
                  <div className="flex gap-2 sm:w-[250px] sm:justify-end">
                    <PrimaryLink href={`/admin/practices/${r.id}/overview`}>Overview</PrimaryLink>
                    <SecondaryLink href={`/dashboard/${r.slug}`}>View as customer</SecondaryLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageBody>
  );
}
