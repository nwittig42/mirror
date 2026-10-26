import { and, eq, isNull } from "drizzle-orm";
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

/** The domain as a name: "https://www.harborplumbing.com/x" becomes "Harborplumbing". */
function nameFromDomain(website: string): string {
  const host = website.trim().replace(/^https?:\/\//i, "").split(/[/?#]/)[0].replace(/^www\./i, "");
  const label = host.split(".")[0] || host;
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

/**
 * A business name for a lead that only gave a website: the first part of the
 * home page's title ("Harbor Plumbing | Austin plumbers" becomes "Harbor
 * Plumbing"; generic parts like "Home" are skipped) when that is a plausible
 * name, else the domain.
 */
export function nameFromTitle(title: string | null, website: string): string {
  const generic = /^(home|welcome|homepage|home page)$/i;
  const first = (title ?? "").split(/ \| | - | \u2013 | \u2014 /).map(t => t.trim())
    .find(t => !generic.test(t) && t.length >= 2 && t.length <= 80);
  return first ?? nameFromDomain(website);
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
async function insertPractice(db: Db, row: { name: string; website: string | null; category: string | null; location: string | null }) {
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
  const lead = row;
  const hasWebsite = !!known(lead.websiteUrl);
  // A lead that gave only a website starts under a name guessed from its
  // domain, renamed once the home page has been read.
  let name = known(lead.practiceName) ?? (hasWebsite ? nameFromTitle(null, lead.websiteUrl!) : "");

  const notes: string[] = [];
  // Null until the practice row exists, so an early failure's notification
  // and note carry no practice to link to.
  let practiceId: string | null = null;
  const finish = async (status: "ready" | "needs_attention", practiceId: string | null) => {
    const note = notes.length ? notes.join(" ") : null;
    await db.update(leads).set({ status, note }).where(eq(leads.id, leadId));
    // The name now on the lead, which a visitor may have typed since setup began.
    const [current] = await db.select({ practiceName: leads.practiceName }).from(leads).where(eq(leads.id, leadId));
    await deps.notify({ practiceName: current?.practiceName ?? name, practiceId, status, note }).catch(() => undefined);
  };

  const setUp = async () => {
    if (!name) throw new Error("The lead has neither a name nor a website");
    const websiteUrl = known(lead.websiteUrl);
    const website = websiteUrl ? (/^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`) : null;
    const leadCategory = known(lead.category);
    const leadLocation = known(lead.location);
    const practice = await insertPractice(db, { name, website, category: leadCategory, location: leadLocation });
    practiceId = practice.id;
    // A lead with no name yet (website only) takes the name the practice was
    // given. Conditional, so a name typed in meanwhile always wins.
    await db.update(leads).set({ practiceName: name }).where(and(eq(leads.id, leadId), isNull(leads.practiceName)));
    await db.insert(nameVariations).values({ practiceId: practice.id, text: name });
    await db.update(leads).set({ practiceId: practice.id }).where(eq(leads.id, leadId));
    // A name typed before the lead pointed at its practice couldn't rename
    // the practice then, so it is applied now.
    const [typed] = await db.select().from(leads).where(eq(leads.id, leadId));
    if (typed && !typed.nameFromSite && known(typed.practiceName) && typed.practiceName !== name) {
      name = typed.practiceName!.trim();
      await db.update(practices).set({ name }).where(eq(practices.id, practice.id));
      await db.update(nameVariations).set({ text: name }).where(eq(nameVariations.practiceId, practice.id));
    }

    const logo = website ? await deps.fetchLogo?.(website).catch(() => null) : null;
    if (logo) await db.update(practices).set({ logo }).where(eq(practices.id, practice.id));

    // Each step below falls back instead of failing the setup, but says why in
    // the server log, since the lead's note can only say that it happened.
    const failed = <T>(step: string, fallback: T) => (err: unknown): T => {
      console.error(`prospect setup for lead ${leadId}: ${step} failed:`, err);
      return fallback;
    };
    const pages = website ? await deps.fetchPages(website).catch(failed("reading the website", [] as SitePage[])) : [];
    if (!website) notes.push("No website, so there's no fact check.");
    else if (pages.length === 0) notes.push("Their website couldn't be read, so the fact sheet is empty and nothing was fact-checked.");

    if (lead.nameFromSite && pages.length) {
      // One conditional update: a name typed in meanwhile (which clears
      // nameFromSite) is not overwritten, and then nothing else changes.
      const siteName = nameFromTitle(pages[0].title, website!);
      if (siteName !== name) {
        const [renamed] = await db.update(leads).set({ practiceName: siteName })
          .where(and(eq(leads.id, leadId), eq(leads.nameFromSite, true))).returning({ id: leads.id });
        if (renamed) {
          await db.update(practices).set({ name: siteName }).where(eq(practices.id, practice.id));
          await db.update(nameVariations).set({ text: siteName })
            .where(and(eq(nameVariations.practiceId, practice.id), eq(nameVariations.text, name)));
          name = siteName;
        }
      }
    }

    const drafted = pages.length
      ? await deps.draftFacts({ businessName: name, pages }).catch(failed("drafting facts", [] as DraftFact[]))
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

    const q = !website
      ? ({ category: null, location: null, questions: [] }) as DraftQuestions
      : await deps.draftQuestions({ businessName: name, pages, category: leadCategory, location: leadLocation })
      .catch(failed("drafting questions", { category: null, location: null, questions: [] } as DraftQuestions));
    const category = leadCategory ?? known(q.category);
    const location = leadLocation ?? known(q.location);
    await db.update(practices).set({ category, location }).where(eq(practices.id, practice.id));

    let questions: DraftQuestions["questions"] = q.questions;
    let questionsLine = `${questions.length} questions drafted from ${website}`;
    const fromWhere = website ? `from ${website}` : "without a website";
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
      questions = generateFallbackPrompts({ name, category, location });
      questionsLine = `${questions.length} standard questions for "${category}" in ${location} (none could be drafted ${fromWhere})`;
      await logActivity(db, practice.id,
        `no buyer questions could be drafted ${fromWhere}, so the standard set for "${category}" in ${location} was used`);
      notes.push(website
        ? `Buyer questions couldn't be drafted from their website, so the standard questions for "${category}" in ${location} were used. Review them on the business page.`
        : `The standard questions for "${category}" in ${location} were used. Review them on the business page.`);
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
  const lead = row;
  const notes = lead.note ? [lead.note] : [];
  const finish = async (status: "ready" | "needs_attention") => {
    const note = notes.length ? notes.join(" ") : null;
    await db.update(leads).set({ status, note }).where(eq(leads.id, lead.id));
    const [practice] = await db.select({ name: practices.name }).from(practices).where(eq(practices.id, practiceId));
    await deps.notify({ practiceName: lead.practiceName ?? practice?.name ?? "", practiceId, status, note }).catch(() => undefined);
  };

  if ("error" in outcome) {
    notes.push(`The first scan failed: ${outcome.error}`);
    return finish("needs_attention");
  }
  if (outcome.blocked) {
    notes.push(`The first scan was blocked. ${blockedReason(outcome.coverage)}`);
    return finish("needs_attention");
  }
  // Ready is marked first, then the send re-reads the lead's email: details
  // that arrive while this runs are then caught by one side or the other
  // (submitDetails sends when it finds the lead ready), never neither. With no
  // email the send is skipped and the report is still ready. The prospect's
  // report has no fact check, since the facts it would check against haven't
  // been reviewed. A failed send is noted, not fatal.
  await db.update(leads).set({ status: "ready" }).where(eq(leads.id, lead.id));
  try {
    await sendReportOnce(db, lead.id, deps);
  } catch {
    notes.push("Their report email couldn't be sent. Send them the summary report yourself.");
  }
  return finish("ready");
}

/**
 * Emails the lead their report, once. The send is claimed first with a
 * conditional update (only a lead not yet emailed matches), so two calls at
 * the same moment send one email. A failed send gives the claim back so a
 * later call can try again, and the error is rethrown. Returns true if this
 * call sent, false if it was skipped (already sent, no email, no practice).
 */
export async function sendReportOnce(db: Db, leadId: string, deps: Pick<ProspectDeps, "sendAudit">): Promise<boolean> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead?.email || !lead.practiceId || lead.auditEmailedAt) return false;
  const [claimed] = await db.update(leads).set({ auditEmailedAt: new Date() })
    .where(and(eq(leads.id, leadId), isNull(leads.auditEmailedAt))).returning({ id: leads.id });
  if (!claimed) return false;
  try {
    await deps.sendAudit(db, lead.practiceId, { email: lead.email, contactName: lead.contactName ?? "" });
  } catch (err) {
    await db.update(leads).set({ auditEmailedAt: null }).where(eq(leads.id, leadId));
    throw err;
  }
  return true;
}
