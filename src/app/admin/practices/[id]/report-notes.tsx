import { updateReportNotes } from "@/app/admin/actions";
import { Card, Note } from "@/components/ui";
import { Button, TextArea } from "@/app/admin/ui";

async function handleUpdateReportNotes(practiceId: string, formData: FormData): Promise<void> {
  "use server";
  const text = formData.get("text");
  if (typeof text !== "string") return;
  await updateReportNotes(practiceId, text.trim());
}

/** The "Next month" paragraph on the customer's monthly report. */
export function ReportNotes({ practiceId, reportNotes }: { practiceId: string; reportNotes: string | null }) {
  return (
    <Card title="Report notes">
      <Note>Shown as &ldquo;Next month&rdquo; on the customer&apos;s monthly report.</Note>
      <form action={handleUpdateReportNotes.bind(null, practiceId)} className="mt-4 flex flex-col gap-3">
        <TextArea name="text" rows={4} defaultValue={reportNotes ?? ""} placeholder="What is planned for next month"
          aria-label="Report notes" className="w-full" />
        <Button className="self-start">Save notes</Button>
      </form>
    </Card>
  );
}
