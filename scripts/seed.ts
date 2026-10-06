/**
 * Seeds a demo business ("Harbor Plumbing and Drain", a fictional plumber in
 * Portland, OR) and the operator user for local dev or a fresh deployment.
 * Safe to re-run.
 *
 * Idempotency: the operator user is upserted by email (create-or-promote).
 * The demo business is upserted by slug, but only the practice row itself
 * is upserted; if a practice with slug "harbor-plumbing" already exists, ALL
 * child inserts (facts, prompts, competitors, name variations) are skipped
 * entirely rather than diffed. This is the simplest robust idempotency for
 * a one-shot demo seed: re-running never creates duplicate children, but it
 * also won't pick up changes made to this file after the first run against
 * a given database. If you need to re-seed the children, delete the
 * practice row (cascades are not set up here on purpose, so check for
 * dependent scans/checks first) or bump the slug. A database that still
 * holds the older "glow" demo is left alone and simply gains this one.
 *
 * The same business is the landing page's example card and the report
 * preview's sample data, so the three stay consistent.
 *
 * Usage: npm run seed. When the keys live in .env.local, which npm run seed
 * does not load by itself: npx tsx --env-file=.env.local scripts/seed.ts
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { loadEnv } from "@/lib/env";
import { practices, users, facts, prompts, competitors, nameVariations } from "@/db/schema";

const DEMO_SLUG = "harbor-plumbing";
const DEMO_NAME = "Harbor Plumbing and Drain";

async function main() {
  const env = loadEnv();
  const db = getDb();

  // Operator user: create-or-promote by email, mirroring the Credentials
  // provider's own upsert in src/lib/auth.ts.
  const [existingOperator] = await db.select().from(users).where(eq(users.email, env.OPERATOR_EMAIL));
  if (!existingOperator) {
    await db.insert(users).values({ email: env.OPERATOR_EMAIL, role: "operator" });
    console.log(`created operator user: ${env.OPERATOR_EMAIL}`);
  } else if (existingOperator.role !== "operator") {
    await db.update(users).set({ role: "operator" }).where(eq(users.id, existingOperator.id));
    console.log(`promoted existing user to operator: ${env.OPERATOR_EMAIL}`);
  } else {
    console.log(`operator user already exists: ${env.OPERATOR_EMAIL}`);
  }

  // Demo business: upsert by slug. See module doc for the idempotency
  // contract: an existing row short-circuits all child inserts below.
  const [existingPractice] = await db.select().from(practices).where(eq(practices.slug, DEMO_SLUG));
  if (existingPractice) {
    console.log(`business "${DEMO_SLUG}" already exists (${existingPractice.id}), skipping fact/prompt/competitor/name-variation seed`);
    return;
  }

  // Category and location feed the question drafter, the namesake guard and
  // the report's wording, so the demo sets both the way a real onboarding does.
  const [practice] = await db.insert(practices).values({
    name: DEMO_NAME,
    slug: DEMO_SLUG,
    website: "https://harbor-plumbing.example",
    category: "Plumber",
    location: "Portland, OR",
  }).returning();

  // Facts in all seven categories, so every section of the fact sheet, the
  // judge and the report has something to show. The license and the
  // not-offered entries are the two contradictions the landing page's example
  // answer is marked against.
  await db.insert(facts).values([
    { practiceId: practice.id, category: "identity", label: "Description", value: "Harbor Plumbing and Drain is a residential and light-commercial plumbing company in Portland, OR, founded in 2012 by Dale Okafor" },
    { practiceId: practice.id, category: "identity", label: "Location", value: "2140 SE Powell Blvd, Portland, OR 97202" },
    { practiceId: practice.id, category: "providers", label: "Owner", value: "Dale Okafor, owner, Oregon-licensed journeyman plumber, 20 years in the trade" },
    { practiceId: practice.id, category: "providers", label: "Lead technician", value: "Priya Natarajan, lead technician, Oregon-licensed journeyman plumber, 9 years in the trade" },
    { practiceId: practice.id, category: "services", label: "Drain cleaning", value: "Drain cleaning and hydro jetting for kitchen, bathroom and main sewer lines" },
    { practiceId: practice.id, category: "services", label: "Water heaters", value: "Tank and tankless water heater repair and replacement (Rheem, Bradford White, Navien)" },
    { practiceId: practice.id, category: "services", label: "Leak and pipe repair", value: "Leak detection, pipe repair and whole-house repiping of galvanized lines" },
    { practiceId: practice.id, category: "services", label: "Sewer line repair", value: "Sewer line repair and replacement, including trenchless options" },
    { practiceId: practice.id, category: "services", label: "Fixture repair", value: "Toilet, faucet and garbage disposal repair and installation" },
    { practiceId: practice.id, category: "services", label: "Sump pumps", value: "Sump pump installation and replacement" },
    { practiceId: practice.id, category: "not_offered", label: "24/7 emergency service", value: "24/7 emergency service: NOT offered. Calls are answered during business hours only" },
    { practiceId: practice.id, category: "not_offered", label: "Septic work", value: "Septic tank pumping and septic system installation: NOT offered" },
    { practiceId: practice.id, category: "pricing", label: "Service call", value: "$89 diagnostic fee, credited toward the repair when the work is done on the same visit" },
    { practiceId: practice.id, category: "pricing", label: "Drain cleaning pricing", value: "Standard drain cleaning from $189; main sewer line from $349; written estimate before any work starts" },
    { practiceId: practice.id, category: "logistics", label: "Hours", value: "Mon to Fri 7am to 6pm, Sat 8am to 2pm, closed Sun" },
    { practiceId: practice.id, category: "logistics", label: "Same-day service", value: "Same-day service on weekdays and Saturdays for calls booked before noon; no 24/7 emergency line" },
    { practiceId: practice.id, category: "logistics", label: "Service area", value: "Portland, Beaverton, Gresham, Lake Oswego and Milwaukie" },
    { practiceId: practice.id, category: "compliance", label: "License", value: "Oregon CCB #221467, licensed plumbing contractor in Oregon only; not licensed in Washington" },
    { practiceId: practice.id, category: "compliance", label: "Insurance", value: "Bonded and insured, $2M general liability" },
  ]);

  // Six category, two branded, two informational. Every prompt names the city,
  // the informational ones included: the engine adapters send no user
  // location, so a prompt without one cannot be answered for Portland, and
  // informational prompts count as earned, so one that cannot name a local
  // business is a guaranteed miss on the demo's named rate.
  await db.insert(prompts).values([
    // category (6)
    { practiceId: practice.id, kind: "category", text: "What are the best plumbers in Portland, Oregon? Name specific businesses." },
    { practiceId: practice.id, kind: "category", text: "Can you recommend a good plumber in Portland, OR for a water heater replacement?" },
    { practiceId: practice.id, kind: "category", text: "Who should I call for drain cleaning in Portland, Oregon?" },
    { practiceId: practice.id, kind: "category", text: "Compare the top plumbing companies in Portland, OR. Which would you choose?" },
    { practiceId: practice.id, kind: "category", text: "I'm looking for a licensed plumber in Southeast Portland. Which ones should I consider?" },
    { practiceId: practice.id, kind: "category", text: "Which plumbers in Portland, Oregon give upfront pricing for a leaking pipe repair?" },
    // branded (2)
    { practiceId: practice.id, kind: "branded", text: "What do you know about Harbor Plumbing and Drain in Portland, OR? Who runs it and are they licensed?" },
    { practiceId: practice.id, kind: "branded", text: "What does Harbor Plumbing and Drain in Portland charge for a service call?" },
    // informational (2)
    { practiceId: practice.id, kind: "informational", text: "How much does it cost to replace a water heater in Portland, OR in 2026?" },
    { practiceId: practice.id, kind: "informational", text: "How do I check whether a plumber in Portland, OR is licensed in Oregon?" },
  ]);

  // The same three the report preview's leaderboard shows ahead of the demo.
  await db.insert(competitors).values([
    { practiceId: practice.id, name: "Rose City Rooter" },
    { practiceId: practice.id, name: "Bridgetown Drain Pros" },
    { practiceId: practice.id, name: "Willamette Pipeworks" },
  ]);

  await db.insert(nameVariations).values([
    { practiceId: practice.id, text: "Harbor Plumbing" },
    { practiceId: practice.id, text: "Harbor Plumbing & Drain" },
  ]);

  console.log(`seeded business "${DEMO_NAME}" (${practice.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
