import { redirect } from "next/navigation";
import { requirePracticeView } from "@/lib/auth";
import { LockedSection } from "@/components/locked";
import { DashboardHeader } from "@/components/dashboard-header";
import { PageBody } from "@/components/ui";

/**
 * Accuracy used to be its own tab. The wrong facts now sit at the top of
 * "What AI says", so this address sends a customer there. A prospect before
 * their call still gets the locked card, and nothing is loaded for them.
 */
export default async function AccuracyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { practice, locked } = await requirePracticeView(slug);
  if (!locked) redirect(`/dashboard/${slug}/answers#wrong-facts`);
  return (
    <PageBody>
      <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="accuracy" />
      <LockedSection title="Accuracy" what="What AI gets right and wrong about your prices, services and hours, and how to fix each one." />
    </PageBody>
  );
}
