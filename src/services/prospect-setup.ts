import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { facts, leads, nameVariations, practices, prompts } from "@/db/schema";
import { uniqueSlug } from "@/core/slug";
import { blockedReason } from "@/core/coverage";
import { generateFallbackPrompts } from "@/core/prompts";
import type { DraftFact } from "@/core/fact-draft-parse";
import type { DraftQuestions } from "@/core/question-draft-parse";
import type { SitePage } from "@/services/fact-drafter";
import type { DraftQuestionsInput } from "@/services/question-drafter";
import type { ScanResult } from "@/services/scan-runner";
import { logActivity } from "@/services/activity";

export interface ProspectDeps {
  fetchPages: (website: string) => Promise<SitePage[]>;
  /** The business's logo from its website, as a `data:` address. Optional: without it the dashboard shows the name alone. */
  fetchLogo?: (website: string) => Promise<string | null>;
  draftFacts: (args: { businessName: string; pages: SitePage[] }) => Promise<DraftFact[]>;
  draftQuestions: (args: DraftQuestionsInput) => Promise<DraftQuestions>;
  /** Drafts the forecast setup (kind of business, area, searches) from the facts and questions just saved. Optional. */
  draftForecast?: (db: Db, practiceId: string) => Promise<unknown>;
  /**
   * Runs the first scan, or starts it as a chain of steps and returns
   * "started"; the chain then calls `finishProspect` when the scan is done.
   */
  scan: (db: Db, practiceId: string) => Promise<ScanResult | "started">;
  notify: (args: { practiceName: string; practiceId: string | null; status: "ready" | "needs_attention"; note: string | null }) => Promise<void>;
  /** Emails the prospect their summary report (PDF attached, no fact check) from the finished scan. */
  sendAudit: (db: Db, practiceId: string, lead: { email: string; contactName: string }) => Promise<void>;
}

/** A typed-in field counts as known only when it has something in it. */
const known = (s: string | null | undefined): string | null => (s && s.trim() ? s.trim() : null);

/** An error's message, short enough for a lead note. */
const errorText = (err: unknown): string => String(err instanceof Error ? err.message : err).slice(0, 200);

/**
 * Postgres's unique-violation code. Drizzle wraps the driver's error as the
 * `cause` of its own "Failed query" error, and the code sits on the driver's
 * (PGlite in tests, Neon in production), so the chain is walked.
 */
function isUniqueViolation(err: unknown): boolean {
  let e = err as { code?: unknown; cause?: unknown } | null | undefined;
  for (let depth = 0; e && typeof e === "object" && depth < 4; depth++) {
    if (e.code === "23505") return true;
    e = e.cause as typeof e;
  }
  return false;
}

/** How many more slugs to try when the chosen one turns out to be taken after all. */
const SLUG_RETRIES = 3;

/**
 * Inserts the paused practice under a slug nobody else holds. The slug is
 * chosen from a read of every existing slug, so two same-name leads prepared
 * at the same moment can both pick the same one and the second insert fails
 * on the unique constraint; the loser treats the failed slug as taken and
 * tries the next suffix, instead of leaving its lead stuck in "preparing".
 */
async function insertPractice(db: Db, row: { name: string; website: string; category: string | null; location: string | null }) {
  const taken = new Set((await db.select({ slug: practices.slug }).from(practices)).map(p => p.slug));
  for (let attempt = 0; ; attempt++) {
    const slug = uniqueSlug(row.name, taken);
    try {
      const [practice] = await db.insert(practices).values({ ...row, slug, active: false }).returning();
      return practice;
    } catch (err) {
      if (attempt >= SLUG_RETRIES || !isUniqueViolation(err)) throw err;
      taken.add(slug);
    }
  }
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
 * What the prospect typed about the business (what kind, and where) is
 * authoritative; the question drafter's guesses only fill what was left
 * blank. When the drafter returns no questions but both are known, the scan
 * runs on the standard set instead of waiting for the operator.
 *
 * Every step that can fail in an expected way (the website, the drafters,
 * the scan, the email) is handled where it happens. Anything else that
 * throws, a database error or a bug, still ends with the lead marked "needs
 * a look" and a note saying what broke, never left in "preparing" forever.
 *
 * Runs once per lead: a lead that already has a practice is left alone.
 */
export async function prepareProspect(db: Db, leadId: string, deps: ProspectDeps): Promise<void> {
  const [row] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!row || row.practiceId) return;
  // Leads may now lack these until task 2 handles that; keep the old behaviour.
  const lead = { ...row, practiceName: row.practiceName ?? "", websiteUrl: row.websiteUrl ?? "" };

  const notes: string[] = [];
  // Null until the practice row exists, so an early failure's notification
  // and note carry no practice to link to.
  let practiceId: string | null = null;
  const finish = async (status: "ready" | "needs_attention", practiceId: string | null) => {
    const note = notes.length ? notes.join(" ") : null;
    await db.update(leads).set({ status, note }).where(eq(leads.id, leadId));
    await deps.notify({ practiceName: lead.practiceName, practiceId, status, note }).catch(() => undefined);
  };

  const setUp = async () => {
    const website = /^https?:\/\//i.test(lead.websiteUrl) ? lead.websiteUrl : `https://${lead.websiteUrl}`;
    const leadCategory = known(lead.category);
    const leadLocation = known(lead.location);
    const practice = await insertPractice(db, { name: lead.practiceName, website, category: leadCategory, location: leadLocation });
    practiceId = practice.id;
    await db.insert(nameVariations).values({ practiceId: practice.id, text: lead.practiceName });
    await db.update(leads).set({ practiceId: practice.id }).where(eq(leads.id, leadId));

    const logo = await deps.fetchLogo?.(website).catch(() => null);
    if (logo) await db.update(practices).set({ logo }).where(eq(practices.id, practice.id));

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

    const q = await deps.draftQuestions({ businessName: lead.practiceName, pages, category: leadCategory, location: leadLocation })
      .catch(() => ({ category: null, location: null, questions: [] }) as DraftQuestions);
    const category = leadCategory ?? known(q.category);
    const location = leadLocation ?? known(q.location);
    await db.update(practices).set({ category, location }).where(eq(practices.id, practice.id));

    let questions: DraftQuestions["questions"] = q.questions;
    let questionsLine = `${questions.length} questions drafted from ${website}`;
    if (questions.length === 0) {
      // The standard questions all name the location, so without one (or
      // without knowing what kind of business to ask about) they would ask
      // about nowhere in particular: the lead is parked for the operator
      // instead, as before. A drafter guess counts as known here: it is the
      // same guess the report's wording already relies on.
      if (!category || !location) {
        notes.push("No buyer questions could be drafted. Add them on the business page, then run the scan.");
        return finish("needs_attention", practice.id);
      }
      questions = generateFallbackPrompts({ name: lead.practiceName, category, location });
      questionsLine = `${questions.length} standard questions for "${category}" in ${location} (none could be drafted from ${website})`;
      await logActivity(db, practice.id,
        `no buyer questions could be drafted from ${website}, so the standard set for "${category}" in ${location} was used`);
      notes.push(`Buyer questions couldn't be drafted from their website, so the standard questions for "${category}" in ${location} were used. Review them on the business page.`);
    }
    await db.insert(prompts).values(questions.map(x => ({ practiceId: practice.id, text: x.text, kind: x.kind })));
    await logActivity(db, practice.id, `set up from the booking form: ${factRows.length} facts, ${questionsLine}`);
    await deps.draftForecast?.(db, practice.id).catch(() => undefined);

    // Saved before the scan starts, since a scan run in steps finishes in
    // another function call, which reads them from here.
    await db.update(leads).set({ note: notes.length ? notes.join(" ") : null }).where(eq(leads.id, leadId));
    let outcome: ScanResult | "started" | { error: string };
    try {
      outcome = await deps.scan(db, practice.id);
    } catch (err) {
      outcome = { error: errorText(err) };
    }
    if (outcome === "started") return;
    return finishProspect(db, practice.id, outcome, deps);
  };

  try {
    await setUp();
  } catch (err) {
    // The caller only logs, so this is the lead's one chance to say what
    // happened: an unexpected throw used to leave it "preparing" with no
    // practice and no note, which admin shows as "Preparing report" forever.
    notes.push(`Setup failed: ${errorText(err)}. Check the business page and finish the setup by hand.`);
    await finish("needs_attention", practiceId);
  }
}

/**
 * The rest of a lead's setup once its first scan is done: a blocked or failed
 * scan leaves the lead needing a look; otherwise the prospect is emailed
 * their summary report and the lead is ready. The operator is told either
 * way. Only a lead still preparing is touched, so a scan's completion
 * delivered twice emails the prospect once.
 */
export async function finishProspect(
  db: Db,
  practiceId: string,
  outcome: ScanResult | { error: string },
  deps: Pick<ProspectDeps, "notify" | "sendAudit">,
): Promise<void> {
  const [row] = await db.select().from(leads)
    .where(and(eq(leads.practiceId, practiceId), eq(leads.status, "preparing")));
  if (!row) return;
  const lead = { ...row, practiceName: row.practiceName ?? "", email: row.email ?? "", contactName: row.contactName ?? "" };
  const notes = lead.note ? [lead.note] : [];
  const finish = async (status: "ready" | "needs_attention") => {
    const note = notes.length ? notes.join(" ") : null;
    await db.update(leads).set({ status, note }).where(eq(leads.id, lead.id));
    await deps.notify({ practiceName: lead.practiceName, practiceId, status, note }).catch(() => undefined);
  };

  if ("error" in outcome) {
    notes.push(`The first scan failed: ${outcome.error}`);
    return finish("needs_attention");
  }
  if (outcome.blocked) {
    notes.push(`The first scan was blocked. ${blockedReason(outcome.coverage)}`);
    return finish("needs_attention");
  }
  // The prospect's report: no fact check, since the facts it would check
  // against haven't been reviewed. A failed send is noted, not fatal.
  try {
    await deps.sendAudit(db, practiceId, { email: lead.email, contactName: lead.contactName });
    await db.update(leads).set({ auditEmailedAt: new Date() }).where(eq(leads.id, lead.id));
  } catch {
    notes.push("Their report email couldn't be sent. Send them the summary report yourself.");
  }
  return finish("ready");
}
