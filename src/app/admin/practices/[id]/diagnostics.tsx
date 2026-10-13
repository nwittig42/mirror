import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { activities } from "@/db/schema";
import { Card, Note } from "@/components/ui";
import { Empty } from "@/app/admin/ui";

/** Internal notes from scans and account events. Operators only. */
export async function Diagnostics({ practiceId }: { practiceId: string }) {
  const rows = await getDb().select().from(activities)
    .where(and(eq(activities.practiceId, practiceId), eq(activities.visibility, "internal")))
    .orderBy(desc(activities.createdAt)).limit(20);
  return (
    <Card title="Diagnostics">
      <Note>Scan warnings, failures and account events. Only we see these, never the customer.</Note>
      {rows.length === 0 ? <div className="mt-3"><Empty>Nothing recorded.</Empty></div> : (
        <ul className="mt-3 divide-y divide-line">
          {rows.map(activity => (
            <li key={activity.id} className="flex flex-wrap gap-x-4 gap-y-0.5 py-2.5 text-[14px]">
              <span className="shrink-0 font-mono text-[13px] text-muted">
                {activity.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </span>
              <span className="min-w-0 flex-1 break-words text-ink-soft">{activity.description}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
