import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { competitors } from "@/db/schema";
import { addCompetitor, hideCompetitor, restoreCompetitor } from "@/app/admin/actions";
import { Card, Note } from "@/components/ui";
import { Button, Empty, TextButton, TextInput } from "@/app/admin/ui";

async function handleHideCompetitor(competitorId: string): Promise<void> {
  "use server";
  await hideCompetitor(competitorId);
}

async function handleRestoreCompetitor(competitorId: string): Promise<void> {
  "use server";
  await restoreCompetitor(competitorId);
}

async function handleAddCompetitor(practiceId: string, formData: FormData): Promise<void> {
  "use server";
  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) return;
  await addCompetitor(practiceId, name.trim());
}

const CHIP = "flex items-center gap-2 rounded-full border py-1 pl-3.5 pr-2.5 text-[14px]";

/** Other businesses the AI tools recommend: the ones we add and the ones scans find. */
export async function Competitors({ practiceId }: { practiceId: string }) {
  const rows = await getDb().select().from(competitors).where(eq(competitors.practiceId, practiceId));
  const active = rows.filter(c => c.status === "active");
  const hidden = rows.filter(c => c.status === "ignored");

  return (
    <Card title="Competitors">
      <Note>
        Add the ones you know. Each scan also adds any business the AI tools recommend, marked &ldquo;found by
        scan&rdquo;. Hide anything that is not a real competitor, like a directory or a product, and scans stop
        counting it.
      </Note>
      <form action={handleAddCompetitor.bind(null, practiceId)} className="mt-4 flex flex-wrap gap-3">
        <TextInput name="name" required placeholder="Competitor name" aria-label="Competitor name" className="flex-1" />
        <Button>Add competitor</Button>
      </form>
      {active.length === 0 ? <div className="mt-4"><Empty>No competitors yet.</Empty></div> : (
        <ul className="mt-4 flex flex-wrap gap-2">
          {active.map(competitor => (
            <li key={competitor.id} className={`${CHIP} border-line bg-ivory text-ink`}>
              {competitor.name}
              {competitor.source === "discovered" && <span className="text-[12px] text-muted">found by scan</span>}
              <form action={handleHideCompetitor.bind(null, competitor.id)}>
                <TextButton title="Hide this competitor">Hide</TextButton>
              </form>
            </li>
          ))}
        </ul>
      )}
      {hidden.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[13px] font-medium text-muted">{hidden.length} hidden</summary>
          <ul className="mt-2 flex flex-wrap gap-2">
            {hidden.map(competitor => (
              <li key={competitor.id} className={`${CHIP} border-dashed border-line text-muted`}>
                {competitor.name}
                <form action={handleRestoreCompetitor.bind(null, competitor.id)}>
                  <TextButton>Restore</TextButton>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
