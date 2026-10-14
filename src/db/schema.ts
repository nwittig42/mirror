import { pgTable, text, uuid, timestamp, boolean, integer, jsonb, pgEnum, primaryKey } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "@auth/core/adapters";

export const roleEnum = pgEnum("role", ["operator", "client"]);
export const factCategoryEnum = pgEnum("fact_category",
  ["identity", "providers", "services", "not_offered", "pricing", "logistics", "compliance"]);
export const promptKindEnum = pgEnum("prompt_kind", ["category", "branded", "informational"]);
export const engineEnum = pgEnum("engine", ["openai", "anthropic", "gemini", "perplexity", "grok", "google"]);
export const positionEnum = pgEnum("position", ["first", "top3", "mentioned", "absent"]);
export const severityEnum = pgEnum("severity", ["critical", "major", "minor"]);
export const findingStatusEnum = pgEnum("finding_status", ["open", "fixed", "verified", "dismissed"]);
export const scanStatusEnum = pgEnum("scan_status", ["running", "complete", "failed", "blocked"]);
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
  // Opens the whole dashboard to the business's own login while it is still
  // paused: a prospect after their call, before weekly scans start. An active
  // business is always open, so this only matters while `active` is false.
  dashboardUnlocked: boolean("dashboard_unlocked").notNull().default(false),
  // Operator-edited "what's planned next month" note, shown on the client's
  // printable monthly report. Nullable, since most practices won't have one set.
  reportNotes: text("report_notes"),
  // Used in the audit report's wording: "When people ask AI for a med spa in
  // Santa Monica...". Optional; the report falls back to neutral phrasing.
  category: text("category"),
  location: text("location"),
  // The business's own logo, read from its website and kept as a `data:`
  // address (src/services/logo.ts). Shown beside its name on the dashboard.
  logo: text("logo"),
  // The paid plan (src/core/plan.ts): 'pulse' | 'partner'. Null = no plan
  // yet. Set by the operator until billing is connected.
  plan: text("plan").$type<import("@/core/plan").Plan>(),
  // What the forecast needs beyond a scan (src/services/forecast.ts): the
  // area and search terms the operator set, the search numbers bought for
  // them, and the owner's own conversion rates. Null = not set up.
  forecast: jsonb("forecast").$type<import("@/services/forecast").ForecastSetup>(),
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
  // The internal type scoring and the judge rely on. Never shown to a customer.
  category: factCategoryEnum("category").notNull(),
  // The heading this fact sits under on the fact sheet, chosen for this one
  // business (see src/core/fact-sections.ts). Null on facts saved before
  // sections existed; those fall back to a default heading for their category.
  section: text("section"),
  label: text("label").notNull(),
  value: text("value").notNull(),
  // 'draft' = pre-filled from the website and not yet confirmed. Drafts are
  // never shown to the judge: only a fact the client has signed off on can
  // make an AI answer "wrong".
  status: text("status").notNull().default("active"), // 'active' | 'archived' | 'draft'
  source: text("source").notNull().default("operator"), // 'operator' | 'client' | 'website'
  // Page a website-drafted fact was read from, so the operator can check it.
  sourceUrl: text("source_url"),
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
  // The two halves of the score, reported separately to the client.
  // visibility = named rate, rank and engine breadth only (no accuracy term).
  // fact = severity-weighted accuracy against the fact sheet; null when no
  // branded answer was judged, because "unknown" must not read as "clean".
  visibilityScore: integer("visibility_score"),
  factScore: integer("fact_score"),
  // Every prompt runs `runs` times per engine. Scoring each run on its own
  // gives a low/high band, which is how we show the score is stable and not
  // one lucky (or unlucky) roll of the engines.
  runs: integer("runs").notNull().default(1),
  scoreLow: integer("score_low"),
  scoreHigh: integer("score_high"),
  // AI-readiness check of the practice's website, run alongside the scan.
  websiteCheck: jsonb("website_check").$type<import("@/core/website-check").WebsiteCheckResult>(),
  // What Google's AI Overview said for each buyer question. Null when the
  // scan ran without it (no DataForSEO login) or the check failed outright.
  aiOverviews: jsonb("ai_overviews").$type<import("@/core/ai-overview").OverviewSummary>(),
  // How many of the answers the scan asked for came back, per engine. Null on
  // scans from before this was recorded.
  coverage: jsonb("coverage").$type<import("@/core/coverage").Coverage>(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
});

export const checks = pgTable("checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  scanId: uuid("scan_id").notNull().references(() => scans.id),
  promptId: uuid("prompt_id").notNull().references(() => prompts.id),
  engine: engineEnum("engine").notNull(),
  // 1-based repeat index. The same prompt is asked `scans.runs` times per
  // engine because answers vary between identical requests.
  run: integer("run").notNull().default(1),
  answerText: text("answer_text").notNull(),
  citations: jsonb("citations").$type<string[]>().notNull().default([]),
  mentioned: boolean("mentioned").notNull(),
  position: positionEnum("position").notNull(),
  competitorsMentioned: jsonb("competitors_mentioned").$type<string[]>().notNull().default([]),
  // Searches the engine ran before answering (empty for engines that don't say).
  searchQueries: jsonb("search_queries").$type<string[]>().notNull().default([]),
  // How the answer describes the practice, rated only when it names them.
  // Null = not named, or the rating failed.
  tone: text("tone"), // 'positive' | 'neutral' | 'mixed' | 'negative'
  toneReason: text("tone_reason"),
  // Every business the answer named, practice included, in order of first
  // appearance. Feeds the head-to-head competitor table.
  namedOrder: jsonb("named_order").$type<string[]>().notNull().default([]),
  // Active fact ids the judge said this answer stated correctly. Feeds the
  // report's "AI got these right" list; empty when not judged.
  factsConfirmed: jsonb("facts_confirmed").$type<string[]>().notNull().default([]),
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
  // The latest scan whose answers repeated this wrong fact. Only findings
  // seen in the latest scan count toward its fact score; older ones stay
  // open for review but no longer cost points. Null = from before this column.
  lastSeenScanId: uuid("last_seen_scan_id").references(() => scans.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  // The fix list (src/core/fix-list.ts). Set when someone starts on an open
  // finding, which shows it as "In progress"; the status stays "open" because
  // AI is still saying it.
  workStartedAt: timestamp("work_started_at"),
  // A short note from us about the fix, shown to the customer ("Emailed Yelp
  // on Oct 14"). Never anything internal.
  note: text("note"),
  noteUpdatedAt: timestamp("note_updated_at"),
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

export const supportStatusEnum = pgEnum("support_status", ["open", "closed"]);

// Client help requests from the dashboard's "Need help?" form. Stored as well
// as emailed so nothing depends on an inbox: the operator works the list in
// /admin and closes each one when answered.
export const leadStatusEnum = pgEnum("lead_status", ["preparing", "ready", "needs_attention"]);

/**
 * Everyone who submitted the /book form. Written before any email is sent,
 * so a lead survives a failed send. Submitting also sets up a draft practice
 * and runs its first scan in the background; `status` tracks that.
 */
// Every forecast shown, kept so it can later be held against what happened.
// One row per scan and per change of inputs, never edited afterwards.
export const forecastSnapshots = pgTable("forecast_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  scanId: uuid("scan_id").references(() => scans.id),
  modelVersion: text("model_version").notNull(),
  // Everything the sums were given, so a later model can be re-run on it.
  input: jsonb("input").$type<import("@/core/forecast").ForecastInput>().notNull(),
  // Extra per year: { leads, customers, visits }, each low / likely / high.
  result: jsonb("result").$type<Pick<import("@/core/forecast").Forecast, "visits" | "leads" | "customers" | "revenue">>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceName: text("practice_name").notNull(),
  websiteUrl: text("website_url").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  bestTimes: text("best_times"),
  // What kind of business it is and where, as the prospect typed them on
  // /book. Optional; authoritative over the question drafter's guesses when
  // set, and what the namesake guard and the fallback prompts rely on.
  category: text("category"),
  location: text("location"),
  status: leadStatusEnum("status").notNull().default("preparing"),
  // Set once setup creates the practice. Null while preparing or if setup died early.
  practiceId: uuid("practice_id").references(() => practices.id),
  // What the operator should know: "website couldn't be read", why a scan failed.
  note: text("note"),
  // When the prospect was emailed their ranking audit. Null = not sent.
  auditEmailedAt: timestamp("audit_emailed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supportRequests = pgTable("support_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  practiceId: uuid("practice_id").notNull().references(() => practices.id),
  userId: uuid("user_id").references(() => users.id),
  email: text("email").notNull(),
  topic: text("topic").notNull(),
  message: text("message").notNull(),
  status: supportStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});
