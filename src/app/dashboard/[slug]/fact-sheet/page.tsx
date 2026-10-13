import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { requirePracticeView } from "@/lib/auth";
import { getDb } from "@/db";
import { facts } from "@/db/schema";
import { groupBySection } from "@/core/fact-sections";
import { DashboardHeader } from "@/components/dashboard-header";
import { LockedSection } from "@/components/locked";
import { Card, Note, PageBody, SectionTitle, buttonClass } from "@/components/ui";

/**
 * The customer's Fact Sheet: the confirmed facts every AI answer is checked
 * against, under the headings chosen for this one business (see
 * src/core/fact-sections.ts). Read-only; a change goes through Help so
 * someone on our side confirms it before it starts marking answers wrong.
 *
 * Only confirmed ("active") facts are loaded. Drafts read off the website are
 * never shown, because nobody has checked them. A prospect before their call
 * gets the locked card and no facts at all.
 */
export default async function FactSheetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { practice, locked } = await requirePracticeView(slug);
  if (locked) {
    return (
      <PageBody>
        <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="facts" />
        <LockedSection
          title="Your Fact Sheet"
          what="The true version of your business: services, prices, hours, people and credentials. Every AI answer is checked against it."
        />
      </PageBody>
    );
  }

  const rows = await getDb().select({
    id: facts.id, category: facts.category, section: facts.section, label: facts.label, value: facts.value, updatedAt: facts.updatedAt,
  })
    .from(facts)
    .where(and(eq(facts.practiceId, practice.id), eq(facts.status, "active")))
    .orderBy(asc(facts.createdAt), asc(facts.label));
  const groups = groupBySection(rows);
  const lastChange = rows.reduce<Date | null>((latest, r) => (!latest || r.updatedAt > latest ? r.updatedAt : latest), null);

  return (
    <PageBody>
      <DashboardHeader slug={slug} practiceName={practice.name} logo={practice.logo} plan={practice.plan} active="facts" />

      <div className="space-y-4">
        <SectionTitle title="Your Fact Sheet">
          The true version of your business, confirmed with you. Every AI answer is checked against these {rows.length} fact{rows.length === 1 ? "" : "s"}.
          {lastChange && ` Last updated ${lastChange.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}.`}
        </SectionTitle>

        {groups.length === 0 ? (
          <Card><Note>Your Fact Sheet is set up on your call. It shows up here once your facts are confirmed.</Note></Card>
        ) : groups.map(g => (
          <Card key={g.title} title={g.title}>
            <dl className="divide-y divide-line">
              {g.facts.map(f => (
                <div key={f.id} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[220px_1fr] sm:gap-6">
                  <dt className="text-[14px] text-muted">{f.label}</dt>
                  <dd className="text-[15px] font-medium text-ink">{f.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}

        <Card title="Something changed?">
          <p className="text-[15px] leading-relaxed text-ink-soft">
            New price, new hours, someone joined or left? Tell us and we update your Fact Sheet, so AI is checked against what is true today.
          </p>
          <div className="mt-4">
            <Link href={`/dashboard/${slug}/help`} className={buttonClass("outline")}>Request a change</Link>
          </div>
        </Card>
      </div>
    </PageBody>
  );
}
