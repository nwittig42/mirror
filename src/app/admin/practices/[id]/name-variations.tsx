import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { nameVariations } from "@/db/schema";
import { addNameVariation } from "@/app/admin/actions";
import { Card, Note } from "@/components/ui";
import { Button, Empty, TextInput } from "@/app/admin/ui";

async function handleAddNameVariation(practiceId: string, formData: FormData): Promise<void> {
  "use server";
  const text = formData.get("text");
  if (typeof text !== "string" || !text.trim()) return;
  await addNameVariation(practiceId, text.trim());
}

/** Other ways the business's name gets written, so a scan still counts them as a mention. */
export async function NameVariations({ practiceId }: { practiceId: string }) {
  const rows = await getDb().select().from(nameVariations).where(eq(nameVariations.practiceId, practiceId));
  return (
    <Card title="Name variations">
      <Note>Other ways people write the name. A scan counts each one as a mention of this business.</Note>
      <form action={handleAddNameVariation.bind(null, practiceId)} className="mt-4 flex flex-wrap gap-3">
        <TextInput name="text" required placeholder="Another spelling or short name" aria-label="Name variation" className="flex-1" />
        <Button>Add variation</Button>
      </form>
      {rows.length === 0 ? <div className="mt-4"><Empty>No name variations yet.</Empty></div> : (
        <ul className="mt-4 flex flex-wrap gap-2">
          {rows.map(variation => (
            <li key={variation.id} className="rounded-full border border-line bg-ivory px-3.5 py-1 text-[14px] text-ink">
              {variation.text}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
