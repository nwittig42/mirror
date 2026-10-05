import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { practices } from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import { getAdapters } from "@/engines";
import { ENGINE_LABELS } from "@/core/types";
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
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/admin" className="mb-2 inline-block text-sm text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400">
        ← Back to admin
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Ask AI live</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Type a question and see, for each AI tool, what it searched, what it answered, and which sites it cited.
        Pick a client to see whether they were named. Nothing here is saved or scored.
      </p>
      <AskPanel engines={engines} practices={rows} />
    </div>
  );
}
