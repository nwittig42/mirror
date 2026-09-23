import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  practices, facts, prompts, competitors, nameVariations, findings, activities,
  practiceMembers, users,
  factCategoryEnum, promptKindEnum, findingStatusEnum,
} from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import {
  addFact, archiveFact, addPrompt, togglePrompt, addCompetitor, hideCompetitor, restoreCompetitor, addNameVariation,
  issueClientPassword, triggerScan, updateFindingStatus, updateReportNotes, logWork, deleteWorkLogEntry,
} from "@/app/admin/actions";
import { ClientAccess, type IssueResult } from "./client-access";

type FactCategory = (typeof factCategoryEnum.enumValues)[number];
type PromptKind = (typeof promptKindEnum.enumValues)[number];
type FindingStatus = (typeof findingStatusEnum.enumValues)[number];

// This page's "Run scan now" form invokes the `triggerScan` server action,
// which kicks off a ~2-minute scan via `after()`. `after()` work counts
// toward the *invoking route's* maxDuration, so without this export Vercel
// kills the scan mid-run on the default limit, leaving the `scans` row
// stuck `running` forever. Mirrors the identical setting on the cron route
// (`src/app/api/cron/weekly-scan/route.ts`). 800s requires a paid Vercel
// plan (see README ship checklist).
export const maxDuration = 800;

const MAX_ACTIVE_PROMPTS = 10;

const CATEGORY_LABELS: Record<FactCategory, string> = {
  identity: "Identity",
  providers: "Providers",
  services: "Services",
  not_offered: "Not offered",
  pricing: "Pricing",
  logistics: "Logistics",
  compliance: "Compliance",
};

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Mirror";

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const primaryButtonClass =
  "rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200";
const secondaryButtonClass =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-black hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900";

// --- Form-parsing wrappers ---------------------------------------------
// The exported actions in `@/app/admin/actions` take typed arguments (so
// they're directly testable and directly callable from other server code).
// Plain HTML forms only ever hand a server action a single `FormData`, so
// each form below is backed by a small local "use server" wrapper that
// extracts fields and delegates to the real action, with the practice/row id
// pre-bound via `.bind(null, id)`.

async function handleAddFact(practiceId: string, formData: FormData): Promise<void> {
  "use server";
  const category = formData.get("category");
  const label = formData.get("label");
  const value = formData.get("value");
  if (typeof category !== "string" || typeof label !== "string" || typeof value !== "string") return;
  if (!label.trim() || !value.trim()) return;
  await addFact(practiceId, { category: category as FactCategory, label: label.trim(), value: value.trim() });
}

async function handleAddPrompt(practiceId: string, formData: FormData): Promise<void> {
  "use server";
  const text = formData.get("text");
  const kind = formData.get("kind");
  if (typeof text !== "string" || typeof kind !== "string" || !text.trim()) return;
  await addPrompt(practiceId, { text: text.trim(), kind: kind as PromptKind });
}

async function handleHideCompetitor(competitorId: string): Promise<void> {
  "use server";
  await hideCompetitor(competitorId);
}

async function handleRestoreCompetitor(competitorId: string): Promise<void> {
  "use server";
  await restoreCompetitor(competitorId);
}

async function handleAddCompetitor(practiceId: string, formData: FormData): Promise<void> {
  "use server";
  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) return;
  await addCompetitor(practiceId, name.trim());
}

async function handleAddNameVariation(practiceId: string, formData: FormData): Promise<void> {
  "use server";
  const text = formData.get("text");
  if (typeof text !== "string" || !text.trim()) return;
  await addNameVariation(practiceId, text.trim());
}

/**
 * Returns the issued password to the calling client component rather than
 * redirecting, so the plaintext never enters the URL. Errors come back as data
 * (a thrown server action would surface as an opaque "unexpected error" in
 * production), which is how the operator learns they typed the operator's own
 * address into the client field.
 */
async function handleIssueClientPassword(
  practiceId: string,
  _previous: IssueResult,
  formData: FormData,
): Promise<IssueResult> {
  "use server";
  const email = formData.get("email");
  if (typeof email !== "string" || !email.trim()) {
    return { error: "Enter the client's email address." };
  }
  try {
    return await issueClientPassword(practiceId, email.trim());
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not issue a password." };
  }
}

async function handleUpdateReportNotes(practiceId: string, formData: FormData): Promise<void> {
  "use server";
  const text = formData.get("text");
  if (typeof text !== "string") return;
  await updateReportNotes(practiceId, text.trim());
}

async function handleLogWork(practiceId: string, formData: FormData): Promise<void> {
  "use server";
  const description = formData.get("description");
  if (typeof description !== "string" || !description.trim()) return;
  await logWork(practiceId, description);
}

async function handleDeleteWorkLogEntry(activityId: string): Promise<void> {
  "use server";
  await deleteWorkLogEntry(activityId);
}

async function handleTriggerScan(practiceId: string): Promise<void> {
  "use server";
  await triggerScan(practiceId);
  redirect(`/admin/practices/${practiceId}?scanStarted=1`);
}

async function handleUpdateFindingStatus(findingId: string, formData: FormData): Promise<void> {
  "use server";
  const status = formData.get("status");
  if (typeof status !== "string") return;
  await updateFindingStatus(findingId, status as FindingStatus);
}

export default async function PracticeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scanStarted?: string }>;
}) {
  await requireOperator();
  const { id: practiceId } = await params;
  const { scanStarted } = await searchParams;

  const db = getDb();
  const [practice] = await db.select().from(practices).where(eq(practices.id, practiceId));
  if (!practice) notFound();

  const [
    factRows, promptRows, competitorRows, variationRows, openFindings, workLog, diagnostics, memberRows,
  ] = await Promise.all([
    db.select().from(facts).where(and(eq(facts.practiceId, practiceId), eq(facts.status, "active"))),
    db.select().from(prompts).where(eq(prompts.practiceId, practiceId)),
    db.select().from(competitors).where(eq(competitors.practiceId, practiceId)),
    db.select().from(nameVariations).where(eq(nameVariations.practiceId, practiceId)),
    db.select().from(findings).where(and(eq(findings.practiceId, practiceId), eq(findings.status, "open")))
      .orderBy(desc(findings.createdAt)),
    db.select().from(activities)
      .where(and(eq(activities.practiceId, practiceId), eq(activities.visibility, "client")))
      .orderBy(desc(activities.createdAt)).limit(30),
    db.select().from(activities)
      .where(and(eq(activities.practiceId, practiceId), eq(activities.visibility, "internal")))
      .orderBy(desc(activities.createdAt)).limit(20),
    db.select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      mustChangePassword: users.mustChangePassword,
    })
      .from(practiceMembers)
      .innerJoin(users, eq(practiceMembers.userId, users.id))
      .where(eq(practiceMembers.practiceId, practiceId)),
  ]);

  const activeCompetitors = competitorRows.filter(c => c.status === "active");
  const hiddenCompetitors = competitorRows.filter(c => c.status === "ignored");

  // The hash itself must not reach the client bundle, so the row is reduced to
  // the one bit the panel actually renders: whether a password exists.
  const members = memberRows.map(m => ({
    id: m.id,
    email: m.email,
    hasPassword: m.passwordHash !== null,
    mustChangePassword: m.mustChangePassword,
  }));

  const activePromptCount = promptRows.filter(p => p.active).length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <Link
          href="/admin"
          className="mb-2 inline-block text-sm text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Back to {appName}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          {appName} · {practice.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {practice.slug} {practice.website ? `· ${practice.website}` : ""} · {practice.active ? "Active" : "Inactive"}
        </p>
      </header>

      {scanStarted && (
        <p className="mb-8 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          Scan started; refresh in ~2 min.
        </p>
      )}

      {/* Fact Sheet */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-black dark:text-zinc-50">Fact Sheet</h2>
        <form action={handleAddFact.bind(null, practiceId)} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <select name="category" defaultValue="identity" className={inputClass}>
            {factCategoryEnum.enumValues.map(cat => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
          <input name="label" required placeholder="Label (e.g. Botox price)" className={inputClass} />
          <input name="value" required placeholder="Value (e.g. $13/unit)" className={inputClass} />
          <button type="submit" className={primaryButtonClass}>Add fact</button>
        </form>

        {factRows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No facts yet.</p>
        ) : (
          <div className="space-y-6">
            {factCategoryEnum.enumValues.map(category => {
              const rows = factRows.filter(f => f.category === category);
              if (rows.length === 0) return null;
              return (
                <div key={category}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {CATEGORY_LABELS[category]}
                  </h3>
                  <table className="w-full border-collapse text-sm">
                    <tbody>
                      {rows.map(fact => (
                        <tr key={fact.id} className="border-b border-zinc-100 dark:border-zinc-900">
                          <td className="py-2 pr-4 font-medium text-black dark:text-zinc-50">{fact.label}</td>
                          <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">{fact.value}</td>
                          <td className="py-2 pr-0 text-right">
                            <form action={archiveFact.bind(null, fact.id)}>
                              <button type="submit" className={secondaryButtonClass}>Archive</button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Prompts */}
      <section className="mb-10">
        <h2 className="mb-1 text-sm font-medium text-black dark:text-zinc-50">Prompts</h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          {activePromptCount}/{MAX_ACTIVE_PROMPTS} active. Each active prompt runs against every engine on every scan.
        </p>
        <form action={handleAddPrompt.bind(null, practiceId)} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input name="text" required placeholder="Prompt text" className={`${inputClass} sm:col-span-2`} />
          <select name="kind" defaultValue="category" className={inputClass}>
            {promptKindEnum.enumValues.map(kind => (
              <option key={kind} value={kind}>{kind}</option>
            ))}
          </select>
          <button type="submit" className={primaryButtonClass}>Add prompt</button>
        </form>

        {promptRows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No prompts yet.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="py-2 pr-4 font-medium">Prompt</th>
                <th className="py-2 pr-4 font-medium">Kind</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {promptRows.map(prompt => (
                <tr key={prompt.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4 text-black dark:text-zinc-50">{prompt.text}</td>
                  <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">{prompt.kind}</td>
                  <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                    {prompt.active ? "Active" : "Inactive"}
                  </td>
                  <td className="py-2 text-right">
                    <form action={togglePrompt.bind(null, prompt.id)}>
                      <button type="submit" className={secondaryButtonClass}>
                        {prompt.active ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Competitors */}
      <section className="mb-10">
        <h2 className="mb-1 text-sm font-medium text-black dark:text-zinc-50">Competitors</h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Names you add are a starting seed. Every scan also records any business the engines
          recommend and adds it here as &ldquo;found by scan&rdquo;. Hide anything that is not a real
          competitor (a directory, a product) and scans will stop counting it.
        </p>
        <form action={handleAddCompetitor.bind(null, practiceId)} className="mb-4 flex gap-3">
          <input name="name" required placeholder="Competitor name" className={`${inputClass} flex-1`} />
          <button type="submit" className={primaryButtonClass}>Add competitor</button>
        </form>
        {activeCompetitors.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No competitors yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {activeCompetitors.map(competitor => (
              <li
                key={competitor.id}
                className="flex items-center gap-2 rounded-full border border-zinc-200 py-1 pl-3 pr-1 text-sm text-black dark:border-zinc-800 dark:text-zinc-50"
              >
                {competitor.name}
                {competitor.source === "discovered" && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">found by scan</span>
                )}
                <form action={handleHideCompetitor.bind(null, competitor.id)}>
                  <button
                    type="submit"
                    title="Hide this competitor"
                    className="rounded-full px-2 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-black dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                  >
                    Hide
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {hiddenCompetitors.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-zinc-500 dark:text-zinc-400">
              {hiddenCompetitors.length} hidden
            </summary>
            <ul className="mt-2 flex flex-wrap gap-2">
              {hiddenCompetitors.map(competitor => (
                <li
                  key={competitor.id}
                  className="flex items-center gap-2 rounded-full border border-dashed border-zinc-300 py-1 pl-3 pr-1 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                >
                  {competitor.name}
                  <form action={handleRestoreCompetitor.bind(null, competitor.id)}>
                    <button type="submit" className="rounded-full px-2 text-xs hover:text-black dark:hover:text-zinc-50">
                      Restore
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Name variations */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-black dark:text-zinc-50">Name variations</h2>
        <form action={handleAddNameVariation.bind(null, practiceId)} className="mb-4 flex gap-3">
          <input name="text" required placeholder="Alternate spelling / name" className={`${inputClass} flex-1`} />
          <button type="submit" className={primaryButtonClass}>Add variation</button>
        </form>
        {variationRows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No name variations yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {variationRows.map(variation => (
              <li
                key={variation.id}
                className="rounded-full border border-zinc-200 px-3 py-1 text-sm text-black dark:border-zinc-800 dark:text-zinc-50"
              >
                {variation.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Run scan now */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-black dark:text-zinc-50">Scan</h2>
        <form action={handleTriggerScan.bind(null, practiceId)}>
          <button type="submit" className={primaryButtonClass}>Run scan now</button>
        </form>
      </section>

      {/* Open findings */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-black dark:text-zinc-50">Open findings</h2>
        {openFindings.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No open findings.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="py-2 pr-4 font-medium">Claim</th>
                <th className="py-2 pr-4 font-medium">Fact value</th>
                <th className="py-2 pr-4 font-medium">Severity</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {openFindings.map(finding => (
                <tr key={finding.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4 text-black dark:text-zinc-50">{finding.claim}</td>
                  <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">{finding.factValue ?? "N/A"}</td>
                  <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">{finding.severity}</td>
                  <td className="py-2">
                    <form action={handleUpdateFindingStatus.bind(null, finding.id)} className="flex items-center gap-2">
                      <select name="status" defaultValue={finding.status} className={inputClass}>
                        {findingStatusEnum.enumValues.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <button type="submit" className={secondaryButtonClass}>Update</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Report notes */}
      <section className="mb-10">
        <h2 className="mb-1 text-sm font-medium text-black dark:text-zinc-50">Report notes</h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Shown as &ldquo;Next month&rdquo; on the client&apos;s printable monthly report.
        </p>
        <form action={handleUpdateReportNotes.bind(null, practiceId)} className="flex flex-col gap-3">
          <textarea
            name="text"
            rows={4}
            defaultValue={practice.reportNotes ?? ""}
            placeholder="What's planned for next month..."
            className={`${inputClass} w-full`}
          />
          <button type="submit" className={`${primaryButtonClass} self-start`}>Save notes</button>
        </form>
      </section>

      <ClientAccess members={members} issue={handleIssueClientPassword.bind(null, practiceId)} />

      {/* Work log — the client reads this one */}
      <section className="mb-10">
        <h2 className="mb-1 text-sm font-medium text-black dark:text-zinc-50">Work log</h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          The client sees these on their dashboard and in their monthly report. Itemise atomically:
          &ldquo;Updated 14 Google service entries&rdquo;, not &ldquo;updated Google&rdquo;.
        </p>
        <form action={handleLogWork.bind(null, practiceId)} className="mb-4 flex gap-2">
          <input
            name="description"
            required
            maxLength={300}
            placeholder="Claimed the Bing Places listing"
            className={`${inputClass} flex-1`}
          />
          <button type="submit" className={primaryButtonClass}>Log work</button>
        </form>
        {workLog.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Nothing logged yet, so the client&apos;s dashboard shows an empty work log.
          </p>
        ) : (
          <ul className="space-y-2">
            {workLog.map(entry => (
              <li key={entry.id} className="flex items-baseline justify-between gap-4 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">
                  <span className="text-zinc-400 dark:text-zinc-500">
                    {entry.createdAt.toISOString().slice(0, 10)}
                  </span>{" "}
                  · {entry.description}
                </span>
                <form action={handleDeleteWorkLogEntry.bind(null, entry.id)}>
                  <button
                    type="submit"
                    className="text-xs text-zinc-500 underline-offset-2 hover:text-red-600 hover:underline dark:text-zinc-400"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Diagnostics — operator only */}
      <section>
        <h2 className="mb-1 text-sm font-medium text-black dark:text-zinc-50">Diagnostics</h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Internal only. Scan warnings, failures, and account events. The client never sees these.
        </p>
        {diagnostics.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Nothing recorded.</p>
        ) : (
          <ul className="space-y-2">
            {diagnostics.map(activity => (
              <li key={activity.id} className="text-sm text-zinc-600 dark:text-zinc-400">
                <span className="text-zinc-400 dark:text-zinc-500">
                  {activity.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </span>{" "}
                · {activity.description}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
