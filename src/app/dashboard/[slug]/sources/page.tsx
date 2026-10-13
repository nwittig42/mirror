import { redirect } from "next/navigation";
import { requirePracticeView } from "@/lib/auth";
import { LockedSection } from "@/components/locked";
import { DashboardHeader } from "@/components/dashboard-header";
import { PageBody } from "@/components/ui";

/**
 * Sources used to be its own tab. It is now the second half of Competitors,
 * so this address sends a customer there. A prospect before their call still
 * gets the locked card, and nothing is loaded for them.
 */
export default async function SourcesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { practice, locked } = await requirePracticeView(slug);
  if (!locked) redirect(`/dashboard/${slug}/competitors#sources`);
  return (
    <PageBody>
      <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="sources" />
      <LockedSection title="Sources" what="The websites AI reads before it answers, and which ones send customers to your competitors." />
    </PageBody>
  );
}
