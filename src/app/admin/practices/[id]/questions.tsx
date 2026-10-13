import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { prompts, promptKindEnum } from "@/db/schema";
import { addPrompt, togglePrompt } from "@/app/admin/actions";
import { Card, Note, Tag } from "@/components/ui";
import { Button, Empty, ROW, Select, TD, TH, TextInput } from "@/app/admin/ui";

type PromptKind = (typeof promptKindEnum.enumValues)[number];

const MAX_ACTIVE_PROMPTS = 10;

const KIND_LABELS: Record<PromptKind, string> = {
  category: "Asks for a recommendation",
  branded: "Names the business",
  informational: "General question",
};

async function handleAddPrompt(practiceId: string, formData: FormData): Promise<void> {
  "use server";
  const text = formData.get("text");
  const kind = formData.get("kind");
  if (typeof text !== "string" || typeof kind !== "string" || !text.trim()) return;
  await addPrompt(practiceId, { text: text.trim(), kind: kind as PromptKind });
}

/** The questions (stored as prompts) each scan puts to every AI tool. */
export async function Questions({ practiceId }: { practiceId: string }) {
  const promptRows = await getDb().select().from(prompts).where(eq(prompts.practiceId, practiceId));
  const activeCount = promptRows.filter(p => p.active).length;

  return (
    <Card title="Questions" aside={<Tag>{activeCount} of {MAX_ACTIVE_PROMPTS} active</Tag>}>
      <Note>Every scan asks each active question to every AI tool.</Note>
      <form action={handleAddPrompt.bind(null, practiceId)} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_260px_auto]">
        <TextInput name="text" required placeholder="A question a customer would ask" aria-label="Question" />
        <Select name="kind" defaultValue="category" aria-label="Kind of question">
          {promptKindEnum.enumValues.map(kind => (
            <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>
          ))}
        </Select>
        <Button>Add question</Button>
      </form>

      {promptRows.length === 0 ? <div className="mt-4"><Empty>No questions yet.</Empty></div> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className={TH}>Question</th>
                <th className={TH}>Kind</th>
                <th className={TH}>Status</th>
                <th className={TH}><span className="sr-only">Change</span></th>
              </tr>
            </thead>
            <tbody>
              {promptRows.map(prompt => (
                <tr key={prompt.id} className={ROW}>
                  <td className={`${TD} text-ink`}>{prompt.text}</td>
                  <td className={`${TD} whitespace-nowrap text-ink-soft`}>{KIND_LABELS[prompt.kind]}</td>
                  <td className={TD}>{prompt.active ? <Tag tone="ok">Active</Tag> : <Tag>Off</Tag>}</td>
                  <td className="py-2 text-right">
                    <form action={togglePrompt.bind(null, prompt.id)}>
                      <Button variant="outline" size="sm">{prompt.active ? "Turn off" : "Turn on"}</Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
