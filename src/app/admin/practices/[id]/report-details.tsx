import { refreshLogo, removeLogo, setPlan, updateReportDetails } from "@/app/admin/actions";
import { Card, Note } from "@/components/ui";
import { Button, Select, TextInput } from "@/app/admin/ui";
import { PLANS, PLAN_LABELS, type Plan } from "@/core/plan";

async function handleUpdateReportDetails(practiceId: string, formData: FormData): Promise<void> {
  "use server";
  const category = formData.get("category");
  const location = formData.get("location");
  await updateReportDetails(practiceId, {
    category: typeof category === "string" ? category : "",
    location: typeof location === "string" ? location : "",
  });
}

async function handleSetPlan(practiceId: string, formData: FormData): Promise<void> {
  "use server";
  const plan = formData.get("plan");
  await setPlan(practiceId, typeof plan === "string" ? plan : "");
}

async function handleRefreshLogo(practiceId: string): Promise<void> {
  "use server";
  await refreshLogo(practiceId);
}

async function handleRemoveLogo(practiceId: string): Promise<void> {
  "use server";
  await removeLogo(practiceId);
}

/** The kind of business and the place, as the report words them, and the logo on its dashboard. */
export function ReportDetails({ practiceId, category, location, logo, hasWebsite, plan }: {
  practiceId: string;
  category: string | null;
  location: string | null;
  logo: string | null;
  hasWebsite: boolean;
  plan: Plan | null;
}) {
  return (
    <Card title="Report details">
      <Note>
        Used in the report&apos;s wording: &ldquo;When people ask AI for a <em>med spa</em> in <em>Santa Monica</em>...&rdquo;
      </Note>
      <form action={handleUpdateReportDetails.bind(null, practiceId)} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <TextInput name="category" defaultValue={category ?? ""} placeholder="Kind of business, e.g. Med spa" aria-label="Kind of business" />
        <TextInput name="location" defaultValue={location ?? ""} placeholder="City or area, e.g. Santa Monica, CA" aria-label="City or area" />
        <Button>Save</Button>
      </form>
      <form action={handleSetPlan.bind(null, practiceId)} className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Note className="min-w-[200px] flex-1">Their plan, shown as a badge on their dashboard. Partner also gets the black look. Nothing is charged.</Note>
        <Select name="plan" defaultValue={plan ?? ""} aria-label="Plan" className="w-auto">
          <option value="">No plan</option>
          {PLANS.map(p => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
        </Select>
        <Button>Save plan</Button>
      </form>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        {logo ? (
          // A stored data: address, so next/image has nothing to optimize.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="Logo" className="h-11 w-11 shrink-0 rounded-[12px] border border-line bg-paper object-contain" />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-dashed border-line text-[12px] text-muted">None</span>
        )}
        <Note className="min-w-[200px] flex-1">
          {logo ? "Their logo, shown beside their name on their dashboard."
            : hasWebsite ? "No logo yet. It is read from their website."
            : "Add the business website to read its logo."}
        </Note>
        {hasWebsite && <form action={handleRefreshLogo.bind(null, practiceId)}><Button>{logo ? "Fetch again" : "Fetch logo"}</Button></form>}
        {logo && <form action={handleRemoveLogo.bind(null, practiceId)}><Button>Remove</Button></form>}
      </div>
    </Card>
  );
}
