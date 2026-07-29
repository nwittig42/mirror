/**
 * Seeds a demo practice ("Glow MedSpa") and the operator user for local dev
 * or a fresh deployment. Safe to re-run.
 *
 * Idempotency: the operator user is upserted by email (create-or-promote).
 * The demo practice is upserted by slug — but only the practice row itself
 * is upserted; if a practice with slug "glow" already exists, ALL child
 * inserts (facts, prompts, competitors, name variations) are skipped
 * entirely rather than diffed. This is the simplest robust idempotency for
 * a one-shot demo seed: re-running never creates duplicate children, but it
 * also won't pick up changes made to this file after the first run against
 * a given database. If you need to re-seed the children, delete the
 * practice row (cascades are not set up here on purpose — check for
 * dependent scans/checks first) or bump the slug.
 *
 * Usage: npm run seed
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { loadEnv } from "@/lib/env";
import { practices, users, facts, prompts, competitors, nameVariations } from "@/db/schema";

async function main() {
  const env = loadEnv();
  const db = getDb();

  // Operator user — create-or-promote by email, mirroring the Credentials
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

  // Demo practice — upsert by slug. See module doc for the idempotency
  // contract: an existing practice short-circuits all child inserts below.
  const [existingPractice] = await db.select().from(practices).where(eq(practices.slug, "glow"));
  if (existingPractice) {
    console.log(`practice "glow" already exists (${existingPractice.id}) — skipping fact/prompt/competitor/name-variation seed`);
    return;
  }

  const [practice] = await db.insert(practices).values({
    name: "Glow MedSpa",
    slug: "glow",
    website: "https://glow-medspa.example",
  }).returning();

  await db.insert(facts).values([
    { practiceId: practice.id, category: "identity", label: "Location", value: "1234 Wilshire Blvd, Santa Monica, CA 90403" },
    { practiceId: practice.id, category: "providers", label: "Lead injector", value: "Dr. Amara Chen, MD — board-certified dermatologist, 12 years injectable experience" },
    { practiceId: practice.id, category: "providers", label: "Nurse injector", value: "Jenna Ruiz, RN, CANS-certified — 8 years injectable experience" },
    { practiceId: practice.id, category: "services", label: "Botox / Dysport", value: "Neuromodulator injections for forehead lines, crow's feet, and glabellar lines" },
    { practiceId: practice.id, category: "services", label: "Dermal fillers", value: "Hyaluronic acid fillers (Juvederm, Restylane) for lips, cheeks, and jawline" },
    { practiceId: practice.id, category: "not_offered", label: "Surgical procedures", value: "Surgical procedures — NOT offered" },
    { practiceId: practice.id, category: "pricing", label: "Botox pricing", value: "$14 per unit; average treatment is 20-40 units" },
    { practiceId: practice.id, category: "logistics", label: "Hours", value: "Tue-Sat, 9am-6pm; closed Sun-Mon" },
  ]);

  await db.insert(prompts).values([
    // category (6)
    { practiceId: practice.id, kind: "category", text: "Best med spa in Santa Monica for Botox" },
    { practiceId: practice.id, kind: "category", text: "Who is the best injector for lip filler in Santa Monica?" },
    { practiceId: practice.id, kind: "category", text: "Top-rated med spa for dermal fillers near Santa Monica" },
    { practiceId: practice.id, kind: "category", text: "Where can I get safe Botox injections in Santa Monica?" },
    { practiceId: practice.id, kind: "category", text: "Best place for lip fillers in West LA" },
    { practiceId: practice.id, kind: "category", text: "Which med spa in Santa Monica has board-certified providers?" },
    // branded (2)
    { practiceId: practice.id, kind: "branded", text: "Tell me about Glow MedSpa in Santa Monica — who are the providers and what are their credentials?" },
    { practiceId: practice.id, kind: "branded", text: "How much does Botox cost at Glow MedSpa?" },
    // informational (2)
    { practiceId: practice.id, kind: "informational", text: "How much does Botox cost per unit in Los Angeles in 2026?" },
    { practiceId: practice.id, kind: "informational", text: "How do I choose a safe med spa in California?" },
  ]);

  await db.insert(competitors).values([
    { practiceId: practice.id, name: "Radiance Aesthetics Santa Monica" },
    { practiceId: practice.id, name: "SoCal Skin & Laser" },
    { practiceId: practice.id, name: "Westside Injectables" },
  ]);

  await db.insert(nameVariations).values([
    { practiceId: practice.id, text: "Glow Med Spa" },
    { practiceId: practice.id, text: "Glow" },
  ]);

  console.log(`seeded practice "Glow MedSpa" (${practice.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
