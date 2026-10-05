/**
 * Drafts a practice's fact sheet from its website and saves the result as
 * drafts for review in /admin. Same code path as the admin "Draft from
 * website" button, for running before the fact sheet call from a terminal.
 *
 * Usage: npx tsx --env-file=.env.local scripts/draft-facts.ts <practice-slug> [--dry-run]
 *
 * --dry-run prints the drafts without saving them.
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { practices } from "@/db/schema";
import { fetchSitePages, draftFactsFromPages, saveDraftFacts } from "@/services/fact-drafter";

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error("usage: draft-facts.ts <practice-slug> [--dry-run]");
  const db = getDb();
  const [practice] = await db.select().from(practices).where(eq(practices.slug, slug));
  if (!practice) throw new Error(`no practice with slug ${slug}`);
  if (!practice.website) throw new Error(`${practice.name} has no website set`);

  const pages = await fetchSitePages(practice.website);
  console.log(`Read ${pages.length} pages:`);
  for (const p of pages) console.log(`  ${p.url} (${p.text.length} chars)`);

  const drafts = await draftFactsFromPages({ businessName: practice.name, pages });
  console.log(`\n${drafts.length} draft facts:`);
  for (const d of drafts) console.log(`  [${d.category}] ${d.label}: ${d.value}${d.sourceUrl ? `  (${d.sourceUrl})` : ""}`);

  if (process.argv.includes("--dry-run")) {
    console.log("\nDry run: nothing saved.");
  } else {
    const added = await saveDraftFacts(db, practice.id, drafts);
    console.log(`\nSaved ${added} new drafts (${drafts.length - added} already on the sheet). Review them in /admin.`);
  }
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
