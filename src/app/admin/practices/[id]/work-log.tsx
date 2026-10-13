import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { activities } from "@/db/schema";
import { deleteWorkLogEntry, logWork } from "@/app/admin/actions";
import { Card, Note } from "@/components/ui";
import { Button, Empty, TextButton, TextInput } from "@/app/admin/ui";

async function handleLogWork(practiceId: string, formData: FormData): Promise<void> {
  "use server";
  const description = formData.get("description");
  if (typeof description !== "string" || !description.trim()) return;
  await logWork(practiceId, description);
}

async function handleDeleteWorkLogEntry(activityId: string): Promise<void> {
  "use server";
  await deleteWorkLogEntry(activityId);
}

/** The work we did for the business. The customer reads this one. */
export async function WorkLog({ practiceId }: { practiceId: string }) {
  const rows = await getDb().select().from(activities)
    .where(and(eq(activities.practiceId, practiceId), eq(activities.visibility, "client")))
    .orderBy(desc(activities.createdAt)).limit(30);
  return (
    <Card title="Work log">
      <Note>
        The customer sees these on their dashboard and in their monthly report. One line per piece of work, with
        the detail: &ldquo;Updated 14 Google service entries&rdquo;, not &ldquo;updated Google&rdquo;.
      </Note>
      <form action={handleLogWork.bind(null, practiceId)} className="mt-4 flex flex-wrap gap-3">
        <TextInput name="description" required maxLength={300} placeholder="Claimed the Bing Places listing"
          aria-label="Work done" className="flex-1" />
        <Button>Log work</Button>
      </form>
      {rows.length === 0 ? (
        <div className="mt-4"><Empty>Nothing logged yet, so the customer&apos;s dashboard shows an empty work log.</Empty></div>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {rows.map(entry => (
            <li key={entry.id} className="flex items-baseline justify-between gap-4 py-2.5">
              <span className="min-w-0 text-[15px] text-ink">
                <span className="mr-3 font-mono text-[13px] text-muted">{entry.createdAt.toISOString().slice(0, 10)}</span>
                {entry.description}
              </span>
              <form action={handleDeleteWorkLogEntry.bind(null, entry.id)}>
                <TextButton className="hover:text-flag">Remove</TextButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
