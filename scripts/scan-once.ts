/**
 * Runs one real scan for a practice and prints the competitor discovery
 * result. Hits all four engines plus the judge and extractor, so it costs a
 * few dollars and takes several minutes. Not run in CI.
 *
 * Usage: npx tsx --env-file=.env.local scripts/scan-once.ts <practice-slug> [--reset-discovered]
 *
 * --reset-discovered deletes the practice's scan-discovered competitor rows
 * first, so the run shows what a fresh discovery pass produces.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { practices, competitors, checks } from "@/db/schema";
import { getAdapters } from "@/engines/index";
import { judgeAnswer } from "@/services/hallucination-judge";
import { extractCompetitors } from "@/services/competitor-extractor";
import { runScan } from "@/services/scan-runner";

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error("usage: scan-once.ts <practice-slug>");
  const db = getDb();
  const [practice] = await db.select().from(practices).where(eq(practices.slug, slug));
  if (!practice) throw new Error(`no practice with slug ${slug}`);

  if (process.argv.includes("--reset-discovered")) {
    const gone = await db.delete(competitors)
      .where(and(eq(competitors.practiceId, practice.id), eq(competitors.source, "discovered"))).returning();
    console.log(`Deleted ${gone.length} previously discovered competitor rows.`);
  }

  const before = await db.select().from(competitors).where(eq(competitors.practiceId, practice.id));
  console.log(`Scanning ${practice.name}. Known competitors before: ${before.map(c => c.name).join(", ") || "(none)"}`);

  const started = Date.now();
  const { scanId, score } = await runScan(db, practice.id, getAdapters(), judgeAnswer, extractCompetitors);
  console.log(`\nScan ${scanId} complete in ${Math.round((Date.now() - started) / 1000)}s. Score ${score}.`);

  const after = await db.select().from(competitors).where(eq(competitors.practiceId, practice.id));
  const discovered = after.filter(c => c.source === "discovered");
  console.log(`\nCompetitors now (${after.length}), discovered by scan: ${discovered.length}`);
  for (const c of after) console.log(`  - ${c.name} [${c.source}${c.status === "ignored" ? ", hidden" : ""}]`);

  const rows = await db.select().from(checks).where(eq(checks.scanId, scanId));
  console.log(`\nPer-check named order (${rows.length} checks):`);
  for (const r of rows) console.log(`  ${r.engine.padEnd(10)} ${r.position.padEnd(9)} ${JSON.stringify(r.namedOrder)}`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
