import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { facts, factCategoryEnum } from "@/db/schema";
import {
  addFact, archiveFact, approveAllDrafts, approveFact, draftFactsFromWebsite, updateFactValue,
} from "@/app/admin/actions";
import { Card, Note } from "@/components/ui";
import { groupBySection, sectionOf } from "@/core/fact-sections";
import { Button, Empty, Notice, ROW, Select, TD, TextInput, linkClass } from "@/app/admin/ui";
import { businessHref } from "./tabs";

type FactCategory = (typeof factCategoryEnum.enumValues)[number];

// What a fact counts as when an answer is checked. This is the internal type,
// not the heading it sits under: a price error weighs more, and a "not
// offered" entry is what catches AI inventing a service.
const KIND_LABELS: Record<FactCategory, string> = {
  services: "A normal fact",
  pricing: "A price",
  not_offered: "Something they do not offer",
  providers: "A person",
  compliance: "A license or credential",
  logistics: "Hours, location or contact",
  identity: "The business itself",
};

// --- Form wrappers -------------------------------------------------------
// The exported actions in `@/app/admin/actions` take typed arguments (so
// they're directly testable and callable from other server code). A plain
// HTML form only hands a server action a `FormData`, so each form here is
// backed by a small local "use server" wrapper that reads the fields and
// calls the real action, with the id pre-bound via `.bind(null, id)`. The
// real action checks the operator every time.

async function handleAddFact(practiceId: string, formData: FormData): Promise<void> {
  "use server";
  const category = formData.get("category");
  const section = formData.get("section");
  const label = formData.get("label");
  const value = formData.get("value");
  if (typeof category !== "string" || typeof label !== "string" || typeof value !== "string") return;
  if (!label.trim() || !value.trim()) return;
  await addFact(practiceId, {
    category: category as FactCategory, label: label.trim(), value: value.trim(),
    section: typeof section === "string" ? section : undefined,
  });
}

/** Lands back on the Setup tab at the fact sheet, with the result in the URL. */
async function handleDraftFacts(practiceId: string): Promise<void> {
  "use server";
  const result = await draftFactsFromWebsite(practiceId);
  const extra: Record<string, string> = "added" in result
    ? { drafted: String(result.added) }
    : { draftError: result.error.slice(0, 200) };
  redirect(businessHref(practiceId, "setup", extra, "fact-sheet"));
}

async function handleApproveFact(factId: string): Promise<void> {
  "use server";
  await approveFact(factId);
}

async function handleApproveAllDrafts(practiceId: string): Promise<void> {
  "use server";
  await approveAllDrafts(practiceId);
}

async function handleUpdateFactValue(factId: string, formData: FormData): Promise<void> {
  "use server";
  const value = formData.get("value");
  const section = formData.get("section");
  if (typeof value !== "string") return;
  await updateFactValue(factId, value, typeof section === "string" ? section : undefined);
}

/** The true facts about the business that every AI answer is checked against. */
export async function FactSheet({ practiceId, website, drafted, draftError }: {
  practiceId: string;
  website: string | null;
  drafted?: string;
  draftError?: string;
}) {
  const db = getDb();
  const [factRows, draftRows] = await Promise.all([
    db.select().from(facts).where(and(eq(facts.practiceId, practiceId), eq(facts.status, "active"))).orderBy(asc(facts.createdAt), asc(facts.label)),
    db.select().from(facts).where(and(eq(facts.practiceId, practiceId), eq(facts.status, "draft"))).orderBy(asc(facts.createdAt), asc(facts.label)),
  ]);
  // Every heading already on this sheet, offered as suggestions so a new fact
  // lands in an existing section and not a near-duplicate of one.
  const headings = groupBySection([...factRows, ...draftRows]).map(g => g.title);

  return (
    <div id="fact-sheet" className="scroll-mt-6">
      <Card title="Fact sheet" aside={
        <form action={handleDraftFacts.bind(null, practiceId)}>
          <Button variant="outline" size="sm" disabled={!website}
            title={website ? "Reads the website and adds draft facts for you to check" : "Add a website first"}>
            Draft from website
          </Button>
        </form>
      }>
        <Note>
          The true facts about this business, under headings chosen for this business. Scans check every AI answer against them.
          &ldquo;Draft from website&rdquo; reads the site and lets AI choose the headings; change any of them on the call.
        </Note>
        <datalist id="fact-sections">{headings.map(h => <option key={h} value={h} />)}</datalist>

        {drafted !== undefined && (
          <Notice tone="ok" className="mt-3">
            Added {drafted} draft fact{drafted === "1" ? "" : "s"} from the website. Check them below, then approve.
          </Notice>
        )}
        {draftError && <Notice tone="flag" className="mt-3">Could not draft facts: {draftError}</Notice>}

        {draftRows.length > 0 && (
          <div className="mt-4 rounded-2xl bg-gold-soft p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[15px] text-ink">
                <span className="font-semibold">{draftRows.length} draft{draftRows.length === 1 ? "" : "s"} to check.</span>{" "}
                Scans ignore a draft until you approve it.
              </p>
              <form action={handleApproveAllDrafts.bind(null, practiceId)}>
                <Button size="sm">Approve all</Button>
              </form>
            </div>
            <ul className="divide-y divide-line rounded-xl bg-paper px-4">
              {draftRows.map(fact => (
                <li key={fact.id} className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-center sm:gap-4">
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-ink">{fact.label}</div>
                    <div className="text-[13px] text-muted">
                      {KIND_LABELS[fact.category]}
                      {fact.sourceUrl && <> · <a href={fact.sourceUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>source</a></>}
                    </div>
                  </div>
                  <form action={handleUpdateFactValue.bind(null, fact.id)} className="flex flex-wrap gap-2">
                    <TextInput name="section" list="fact-sections" defaultValue={sectionOf(fact)} aria-label={`Heading for ${fact.label}`} className="w-40" />
                    <TextInput name="value" defaultValue={fact.value} aria-label={`Value for ${fact.label}`} className="min-w-[160px] flex-1" />
                    <Button variant="outline" size="sm">Save</Button>
                  </form>
                  <div className="flex gap-2">
                    <form action={handleApproveFact.bind(null, fact.id)}>
                      <Button variant="outline" size="sm">Approve</Button>
                    </form>
                    <form action={archiveFact.bind(null, fact.id)}>
                      <Button variant="outline" size="sm">Reject</Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form action={handleAddFact.bind(null, practiceId)} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_190px_auto]">
          <TextInput name="section" list="fact-sections" placeholder="Heading, e.g. Pricing" aria-label="Heading" />
          <TextInput name="label" required placeholder="Label, e.g. Call-out fee" aria-label="Label" />
          <TextInput name="value" required placeholder="Value, e.g. $89" aria-label="Value" />
          <Select name="category" defaultValue="services" aria-label="What this fact counts as">
            {(Object.keys(KIND_LABELS) as FactCategory[]).map(cat => (
              <option key={cat} value={cat}>{KIND_LABELS[cat]}</option>
            ))}
          </Select>
          <Button>Add fact</Button>
        </form>

        {factRows.length === 0 ? <div className="mt-4"><Empty>No facts yet.</Empty></div> : (
          <div className="mt-5 space-y-5">
            {groupBySection(factRows).map(({ title, facts: rows }) => {
              return (
                <div key={title}>
                  <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
                    {title}
                  </h3>
                  <table className="w-full border-collapse">
                    <tbody>
                      {rows.map(fact => (
                        <tr key={fact.id} className={ROW}>
                          <td className={`${TD} w-1/3 font-semibold text-ink`}>{fact.label}</td>
                          <td className={`${TD} break-words text-ink-soft`}>{fact.value}</td>
                          <td className="py-2 text-right">
                            <form action={archiveFact.bind(null, fact.id)}>
                              <Button variant="outline" size="sm">Archive</Button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
