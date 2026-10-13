import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { practices, supportRequests } from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import { setSupportRequestStatus } from "@/app/admin/actions";
import { SUPPORT_TOPICS, type SupportTopic } from "@/services/support";
import { Card, Note, PageBody, Tag } from "@/components/ui";
import { Button, Empty, PageTitle, TextButton, linkClass } from "@/app/admin/ui";

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
    <PageBody wide>
      <PageTitle title="Support">
        Questions sent from the Help page of a customer&apos;s dashboard. We promise a reply within one business day.
        Answer by email, then mark it answered here.
      </PageTitle>
      <div id="support" className="space-y-4">
        <Card title="Waiting for a reply" aside={openSupport.length > 0 ? <Tag tone="flag">{openSupport.length} open</Tag> : undefined}>
          {openSupport.length === 0 ? <Empty>Nothing waiting.</Empty> : (
            <ul className="divide-y divide-line">
              {openSupport.map(r => (
                <li key={r.id} className="py-4 first:pt-1 last:pb-1">
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-[15px]">
                    <span>
                      <Link href={`/admin/practices/${r.practiceId}/overview`} className={linkClass}>{r.practiceName}</Link>
                      <span className="text-muted"> · {SUPPORT_TOPICS[r.topic as SupportTopic] ?? r.topic} · </span>
                      <a href={`mailto:${r.email}`} className="text-ink-soft underline-offset-4 hover:text-gold hover:underline">{r.email}</a>
                    </span>
                    <span className={`text-[13px] ${r.ageHours >= 24 ? "font-semibold text-flag" : "text-muted"}`}>
                      {r.ageHours < 1 ? "just now" : `${r.ageHours}h ago`}
                    </span>
                  </div>
                  <p className="mb-3 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">{r.message}</p>
                  <form action={handleSupportStatus.bind(null, r.id, "closed")}>
                    <Button variant="outline" size="sm">Mark answered</Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {closedSupport.length > 0 && (
          <Card>
            <details>
              <summary className="cursor-pointer text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
                Recently answered ({closedSupport.length})
              </summary>
              <ul className="mt-3 divide-y divide-line">
                {closedSupport.map(r => (
                  <li key={r.id} className="flex items-baseline justify-between gap-3 py-2.5">
                    <Note className="min-w-0 truncate">{r.practiceName} · {r.message}</Note>
                    <form action={handleSupportStatus.bind(null, r.id, "open")}>
                      <TextButton>Reopen</TextButton>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          </Card>
        )}
      </div>
    </PageBody>
  );
}
