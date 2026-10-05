import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { facts, leads, nameVariations, practices, prompts } from "@/db/schema";
import { uniqueSlug } from "@/core/slug";
import { blockedReason } from "@/core/coverage";
import type { DraftFact } from "@/core/fact-draft-parse";
import type { DraftQuestions } from "@/core/question-draft-parse";
import type { SitePage } from "@/services/fact-drafter";
import type { ScanResult } from "@/services/scan-runner";
import { logActivity } from "@/services/activity";

export interface ProspectDeps {
  fetchPages: (website: string) => Promise<SitePage[]>;
  draftFacts: (args: { businessName: string; pages: SitePage[] }) => Promise<DraftFact[]>;
  draftQuestions: (args: { businessName: string; pages: SitePage[] }) => Promise<DraftQuestions>;
  scan: (db: Db, practiceId: string) => Promise<ScanResult>;
  notify: (args: { practiceName: string; practiceId: string | null; status: "ready" | "needs_attention"; note: string | null }) => Promise<void>;
  /** Emails the prospect their summary report (PDF attached, no fact check) from the finished scan. */
  sendAudit: (db: Db, practiceId: string, lead: { email: string; contactName: string }) => Promise<void>;
}

/**
 * What happens after someone submits /book, in the background: a paused
 * practice, a fact sheet and buyer questions drafted from their website, and
 * a first scan, so the report is ready by the sales call. When the scan
 * finishes, the prospect is emailed their summary report (no fact check), and the operator is
 * told the full report is ready (or what needs a look) to review before the call.
 *
 * Facts drafted from the prospect's own site go straight onto the sheet as
 * active (source "website"), so the first scan has something to check AI
 * against. The operator corrects them in admin before the call.
 *
 * Runs once per lead: a lead that already has a practice is left alone.
 */
export async function prepareProspect(db: Db, leadId: string, deps: ProspectDeps): Promise<void> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead || lead.practiceId) return;

  const notes: string[] = [];
  const finish = async (status: "ready" | "needs_attention", practiceId: string | null) => {
    const note = notes.length ? notes.join(" ") : null;
    await db.update(leads).set({ status, note }).where(eq(leads.id, leadId));
    await deps.notify({ practiceName: lead.practiceName, practiceId, status, note }).catch(() => undefined);
  };

  const website = /^https?:\/\//i.test(lead.websiteUrl) ? lead.websiteUrl : `https://${lead.websiteUrl}`;
  const taken = new Set((await db.select({ slug: practices.slug }).from(practices)).map(p => p.slug));
  const [practice] = await db.insert(practices).values({
    name: lead.practiceName, slug: uniqueSlug(lead.practiceName, taken), website, active: false,
  }).returning();
  await db.insert(nameVariations).values({ practiceId: practice.id, text: lead.practiceName });
  await db.update(leads).set({ practiceId: practice.id }).where(eq(leads.id, leadId));

  const pages = await deps.fetchPages(website).catch(() => [] as SitePage[]);
  if (pages.length === 0) notes.push("Their website couldn't be read, so the fact sheet is empty and nothing was fact-checked.");

  const drafted = pages.length
    ? await deps.draftFacts({ businessName: lead.practiceName, pages }).catch(() => [] as DraftFact[])
    : [];
  const seen = new Set<string>();
  const factRows = drafted.filter(f => !seen.has(f.label.toLowerCase()) && seen.add(f.label.toLowerCase()));
  if (factRows.length) {
    await db.insert(facts).values(factRows.map(f => ({
      practiceId: practice.id, category: f.category, label: f.label, value: f.value,
      status: "active", source: "website", sourceUrl: f.sourceUrl,
    })));
  } else if (pages.length) {
    notes.push("No facts could be drafted from their website.");
  }

  const q = await deps.draftQuestions({ businessName: lead.practiceName, pages })
    .catch(() => ({ category: null, location: null, questions: [] }) as DraftQuestions);
  await db.update(practices).set({ category: q.category, location: q.location }).where(eq(practices.id, practice.id));
  if (q.questions.length === 0) {
    notes.push("No buyer questions could be drafted. Add them on the practice page, then run the scan.");
    return finish("needs_attention", practice.id);
  }
  await db.insert(prompts).values(q.questions.map(x => ({ practiceId: practice.id, text: x.text, kind: x.kind })));
  await logActivity(db, practice.id, `set up from the booking form: ${factRows.length} facts, ${q.questions.length} questions drafted from ${website}`);

  try {
    const result = await deps.scan(db, practice.id);
    if (result.blocked) {
      notes.push(`The first scan was blocked. ${blockedReason(result.coverage)}`);
      return finish("needs_attention", practice.id);
    }
  } catch (err) {
    notes.push(`The first scan failed: ${String(err instanceof Error ? err.message : err).slice(0, 200)}`);
    return finish("needs_attention", practice.id);
  }
  // The prospect's report: no fact check, since the facts it would check
  // against haven't been reviewed. A failed send is noted, not fatal.
  try {
    await deps.sendAudit(db, practice.id, { email: lead.email, contactName: lead.contactName });
    await db.update(leads).set({ auditEmailedAt: new Date() }).where(eq(leads.id, leadId));
  } catch {
    notes.push("Their report email couldn't be sent. Send them the summary report yourself.");
  }
  return finish("ready", practice.id);
}
