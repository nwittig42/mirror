import { pgTable, text, uuid, timestamp, boolean, integer, jsonb, pgEnum, primaryKey } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "@auth/core/adapters";

export const roleEnum = pgEnum("role", ["operator", "client"]);
export const factCategoryEnum = pgEnum("fact_category",
  ["identity", "providers", "services", "not_offered", "pricing", "logistics", "compliance"]);
export const promptKindEnum = pgEnum("prompt_kind", ["category", "branded", "informational"]);
export const engineEnum = pgEnum("engine", ["openai", "anthropic", "gemini", "perplexity"]);
export const positionEnum = pgEnum("position", ["first", "top3", "mentioned", "absent"]);
export const severityEnum = pgEnum("severity", ["critical", "major", "minor"]);
export const findingStatusEnum = pgEnum("finding_status", ["open", "fixed", "verified", "dismissed"]);
export const scanStatusEnum = pgEnum("scan_status", ["running", "complete", "failed"]);
export const activityVisibilityEnum = pgEnum("activity_visibility", ["internal", "client"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  // Required by @auth/drizzle-adapter's DefaultPostgresUsersTable shape, even
  // though the product has no avatar-upload feature yet.
  image: text("image"),
  role: roleEnum("role").notNull().default("client"),
  // scrypt hash written by src/lib/password.ts. Nullable, and that null is
  // meaningful: a client who has only ever used a magic link has no password
  // and cannot be signed into via the Credentials provider at all.
  passwordHash: text("password_hash"),
  // Set when the operator issues a temporary password on the onboarding call.
  // While true, middleware pins the user to /change-password.
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  emailVerified: timestamp("email_verified"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// The next three tables exist solely to satisfy @auth/drizzle-adapter's
// Postgres adapter contract (Resend magic-link verification tokens, and
// OAuth-shaped account linking for parity with the adapter's expected
// schema). Column names/types mirror the adapter's documented
// `defineTables` default, with `userId` switched from text to uuid to
// reference our uuid-keyed `users` table.
export const accounts = pgTable("accounts", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<AdapterAccountType>().notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (account) => [
  primaryKey({ columns: [account.provider, account.providerAccountId] }),
]);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires").notNull(),
}, (vt) => [
  primaryKey({ columns: [vt.identifier, vt.token] }),
]);

export const practices = pgTable("practices", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  website: text("website"),
  active: boolean("active").notNull().default(true),
  // Operator-edited "what's planned next month" note, shown on the client's
  // printable monthly report. Nullable, since most practices won't have one set.
  reportNotes: text("report_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const practiceMembers = pgTable("practice_members", {
  userId: uuid("user_id").notNull().references(() => users.id),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
}, t => [primaryKey({ columns: [t.userId, t.practiceId] })]);

export const nameVariations = pgTable("name_variations", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  text: text("text").notNull(),
});

export const competitors = pgTable("competitors", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  name: text("name").notNull(),
  // 'operator' = typed in admin; 'discovered' = an engine recommended it and
  // the scan's extractor picked it up. Discovered names are what make the
  // competitor report real rather than limited to what we already knew.
  source: text("source").notNull().default("operator"), // 'operator' | 'discovered'
  // 'ignored' hides a wrong discovery (a directory, a product) and keeps the
  // scan from re-adding it next week.
  status: text("status").notNull().default("active"), // 'active' | 'ignored'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const facts = pgTable("facts", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  category: factCategoryEnum("category").notNull(),
  label: text("label").notNull(),
  value: text("value").notNull(),
  status: text("status").notNull().default("active"), // 'active' | 'archived'
  source: text("source").notNull().default("operator"), // 'operator' | 'client'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const prompts = pgTable("prompts", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  text: text("text").notNull(),
  kind: promptKindEnum("kind").notNull(),
  active: boolean("active").notNull().default(true),
});

export const scans = pgTable("scans", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  status: scanStatusEnum("status").notNull().default("running"),
  score: integer("score"),
  citationRate: integer("citation_rate"),      // stored as 0-100
  positionScore: integer("position_score"),    // 0-100
  breadthScore: integer("breadth_score"),      // 0-100
  accuracyScore: integer("accuracy_score"),    // 0-100
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
});

export const checks = pgTable("checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  scanId: uuid("scan_id").notNull().references(() => scans.id),
  promptId: uuid("prompt_id").notNull().references(() => prompts.id),
  engine: engineEnum("engine").notNull(),
  answerText: text("answer_text").notNull(),
  citations: jsonb("citations").$type<string[]>().notNull().default([]),
  mentioned: boolean("mentioned").notNull(),
  position: positionEnum("position").notNull(),
  competitorsMentioned: jsonb("competitors_mentioned").$type<string[]>().notNull().default([]),
  // Every business the answer named, practice included, in order of first
  // appearance. Feeds the head-to-head competitor table.
  namedOrder: jsonb("named_order").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const findings = pgTable("findings", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  checkId: uuid("check_id").notNull().references(() => checks.id),
  factId: uuid("fact_id").references(() => facts.id),
  claim: text("claim").notNull(),
  factValue: text("fact_value"),
  severity: severityEnum("severity").notNull(),
  status: findingStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  description: text("description").notNull(),
  // Who this line is for. 'internal' is the operator's diagnostic trail (scan
  // warnings, judge failures, credential issuance); 'client' is the work log
  // shown on the dashboard and printed in the monthly report.
  //
  // The default is deliberately 'internal', so a new logActivity() call site
  // added anywhere in the codebase cannot accidentally publish to a client.
  // Reaching the client is opt-in, one call site at a time.
  visibility: activityVisibilityEnum("visibility").notNull().default("internal"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
