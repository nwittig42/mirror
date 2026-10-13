import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { practices } from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import { getAdapters } from "@/engines";
import { ENGINE_LABELS } from "@/core/types";
import { PageBody } from "@/components/ui";
import { PageTitle } from "@/app/admin/ui";
import { AskPanel } from "./ask-panel";

// Each engine call is its own server action, and a web-searching answer can
// take a minute or more.
export const maxDuration = 300;

/** Operators only: ask every AI tool one question live and watch the answers come in. */
export default async function AskPage() {
  await requireOperator();
  const rows = await getDb().select({ id: practices.id, name: practices.name }).from(practices).orderBy(asc(practices.name));
  const engines = getAdapters().map(a => ({ key: a.name, label: ENGINE_LABELS[a.name] }));

  return (
    <PageBody wide>
      <PageTitle title="Ask AI live">
        Type a question and see what each AI tool searched, what it answered and which sites it cited. Pick a
        business to see if it was named. Nothing here is saved or scored.
      </PageTitle>
      <AskPanel engines={engines} practices={rows} />
    </PageBody>
  );
}
