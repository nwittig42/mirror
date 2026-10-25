import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import {
  scans, scanAnswers, checks, findings, prompts, nameVariations, competitors, facts, practices,
} from "@/db/schema";
import { findMatches, mentionKind, type MentionKind } from "@/core/mention";
import { classifyPosition } from "@/core/position";
import { computeVisibility, computeVisibilityParts, computeOverall, computeFactScore, scoreBand } from "@/core/scoring";
import { findingKey, normalizeClaim, worseSeverity } from "@/core/finding-key";
import { confirmedByScan } from "@/core/fix-list";
import { blockedReason, summarizeCoverage, type Coverage } from "@/core/coverage";
import { namesakeVeto, type ToneRating } from "@/core/tone";
import type { CheckResult } from "@/core/types";
import type { EngineAdapter } from "@/engines/types";
import { EngineError } from "@/engines/types";
import type { judgeAnswer } from "@/services/hallucination-judge";
import type { extractCompetitors } from "@/services/competitor-extractor";
import { canonicalName, reconcileCompetitors } from "@/core/competitors";
import { logActivity } from "@/services/activity";
import { saveForecastSnapshot } from "@/services/forecast";
import type { rateTone } from "@/services/tone-rater";
import type { runWebsiteCheck } from "@/services/website-check";
import type { checkAiOverviews } from "@/services/ai-overviews";

type Judge = typeof judgeAnswer;
type Extractor = typeof extractCompetitors;

type ScoringCheck = Pick<CheckResult, "engine" | "promptKind" | "mentioned" | "position">;

/**
 * A finding this scan created, carrying the surrounding context (which engine
 * said it, in answer to which prompt) that the `findings` row itself doesn't
 * store. Returned so the caller can alert on it without re-querying and
 * without having to guess which of a practice's open findings are new.
 */
export interface NewFinding {
  claim: string;
  factValue: string | null;
  severity: "critical" | "major" | "minor";
  engine: string;
  prompt: string;
}

const pct = (fraction: number): number => Math.round(fraction * 100);

export interface ScanResult {
  scanId: string;
  /** Null when the scan was blocked for missing too many answers. */
  score: number | null;
  newFindings: NewFinding[];
  blocked: boolean;
  coverage: Coverage;
}

export interface ScanOptions {
  /**
   * How many times each prompt is asked of each engine. Identical requests
   * get different answers, so one run per prompt is a coin flip; three is
   * enough to see whether a mention is real. Default 1 (tests, one-offs).
   */
  runs?: number;
  /**
   * Engine requests in flight at once. Default: one per engine, and never
   * fewer than 4, so a scan that asks a sixth engine takes no longer than one
   * that asks four while each engine sees about the load it always did.
   * Reading an answer once it is back (extractor, judge, tone rater) does not
   * count against this.
   */
  concurrency?: number;
  /** Backoff before each retry of a rate-limited or flaky engine call. */
  retryDelaysMs?: number[];
  /**
   * Rates how each answer that names the business describes it, and whether
   * it is this business or a namesake. Optional so a scan without it still
   * runs; tone is then left empty, not guessed, and nothing is vetoed.
   */
  rateTone?: typeof rateTone;
  /** Runs the website check alongside the engine calls; stored on the scan. */
  checkWebsite?: typeof runWebsiteCheck;
  /**
   * Reads Google's AI Overview for each buyer question alongside the engine
   * calls; stored on the scan. It is a finding of its own and never touches
   * the score or coverage.
   */
  checkAiOverviews?: typeof checkAiOverviews;
  /**
   * Pause before the one extra try every retriable failure gets once the rest
   * of the scan has finished. A rate limit often clears in that time.
   */
  finalRetryDelayMs?: number;
  /**
   * Epoch ms after which no new engine call starts. Calls not started count
   * as failed, so the scan settles on what came back (and blocks if that is
   * too little) instead of being killed mid-write by the platform timeout.
   */
  deadline?: number;
}

/**
 * How long a scan may keep starting engine calls, measured from when it
 * starts. Leaves ~150s of the Hobby plan's 300s function budget to finish
 * in-flight calls (an engine call times out at 120s) and write the results,
 * so the platform never kills a scan mid-write.
 */
export const SCAN_DEADLINE_MS = 150_000;
/**
 * A scan still "running" with no progress for this long was killed and will
 * never finish. Every step marks progress, and no step runs past 300s.
 */
export const SCAN_STUCK_AFTER_MS = 10 * 60_000;

/** Whether a scan still marked running has gone longer without progress than any step could take. */
export function scanLooksStuck(updatedAt: Date, now: number = Date.now()): boolean {
  return now - updatedAt.getTime() > SCAN_STUCK_AFTER_MS;
}

const RETRIABLE_STATUS = new Set([408, 429, 500, 502, 503, 504, 529]);
const DEFAULT_RETRY_DELAYS_MS = [2_000, 6_000];

function isRetriable(err: unknown): boolean {
  if (err instanceof EngineError) return RETRIABLE_STATUS.has(err.status);
  // Undici reports a dropped connection as a bare TypeError("fetch failed").
  return err instanceof TypeError;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retries an engine call on rate limits and transient failures. Gemini's free
 * tier in particular answers 429 on bursts, and before this every one of
 * those was a lost answer and a lower score.
 */
async function withRetry<T>(fn: () => Promise<T>, delays: number[], canRetry: () => boolean = () => true): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= delays.length || !isRetriable(err) || !canRetry()) throw err;
      await sleep(delays[attempt]);
    }
  }
}

/** Runs `worker` over `items` with at most `limit` in flight, results in input order. */
async function mapPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  });
  await Promise.all(lanes);
  return results;
}

/** Returns a function that runs what it is given with at most `limit` in flight; the rest wait their turn. */
function limiter(limit: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    // A finished call hands its slot straight to the next in line, so a
    // newcomer can never slip in between and push the count over the limit.
    if (active >= limit) await new Promise<void>(resolve => waiting.push(resolve));
    else active++;
    try {
      return await fn();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

/** Engine requests in flight at once, however few engines a scan asks. */
const MIN_CONCURRENCY = 4;

/**
 * Answers being read (extractor, judge, tone rater) at once. These calls go
 * to the judge model, not to the engines being measured, so they have their
 * own limit and never hold up the next engine request.
 */
const REVIEW_CONCURRENCY = 6;

type PromptRow = typeof prompts.$inferSelect;
type JudgeResult = Awaited<ReturnType<Judge>>;
type EngineName = EngineAdapter["name"];

/** Everything the network half of a scan learns about one (prompt, run, engine). */
type Gathered =
  | { prompt: PromptRow; run: number; adapter: { name: EngineName }; ok: false; retriable: boolean }
  | {
      prompt: PromptRow; run: number; adapter: { name: EngineName }; ok: true;
      answer: string; citations: string[]; searchQueries: string[];
      tone: ToneRating | null;
      discovered: string[] | null;
      judged: JudgeResult | null | undefined; // undefined = not judged
    };

/** What a scan is for, which decides what happens once its last step finishes. */
export type ScanPurpose = "manual" | "weekly" | "prospect";

export interface StepOptions extends ScanOptions {
  /** Epoch ms after which this step starts no new engine call or retry. */
  startBy: number;
  /** Epoch ms at which this step stops waiting for calls still running. */
  stopBy: number;
  /** The clock, for tests. */
  now?: () => number;
  /**
   * Calls not started by `startBy` count as failed, so the scan settles now
   * instead of leaving them for a later step.
   */
  lastChance?: boolean;
}

/** Opens a scan row. The scan then runs through `gatherStep` and `finishScan`. */
export async function startScan(
  db: Db, practiceId: string, opts: { runs: number; purpose: ScanPurpose },
): Promise<string> {
  const [scan] = await db.insert(scans)
    // Progress is stamped from this clock everywhere, so the stuck sweep
    // never compares it with the database's own idea of now.
    .values({ practiceId, runs: Math.max(1, Math.floor(opts.runs)), purpose: opts.purpose, updatedAt: new Date() })
    .returning();
  return scan.id;
}

async function loadScanContext(db: Db, practiceId: string) {
  const [[practice], promptRows, variationRows, competitorRows, factRows] = await Promise.all([
    db.select().from(practices).where(eq(practices.id, practiceId)),
    db.select().from(prompts).where(and(eq(prompts.practiceId, practiceId), eq(prompts.active, true))),
    db.select().from(nameVariations).where(eq(nameVariations.practiceId, practiceId)),
    db.select().from(competitors).where(eq(competitors.practiceId, practiceId)),
    db.select().from(facts).where(and(eq(facts.practiceId, practiceId), eq(facts.status, "active"))),
  ]);
  const practiceNames = Array.from(new Set([practice.name, ...variationRows.map(v => v.text)]));
  return { practice, promptRows, competitorRows, factRows, practiceNames };
}

/** Every (prompt, run, engine) a scan asks, in the fixed order the record phase walks. */
function buildTasks<A extends { name: EngineName }>(promptRows: PromptRow[], runs: number, adapters: A[]) {
  return promptRows.flatMap(prompt =>
    Array.from({ length: runs }, (_, r) => adapters.map(adapter => ({ prompt, run: r + 1, adapter }))).flat(),
  );
}

const taskKey = (promptId: string, run: number, engine: string) => `${promptId}|${run}|${engine}`;

/** Waits for `work`, but no later than `stopBy`. True when the work finished. */
async function settleBy(work: Promise<unknown>, stopBy: number, now: () => number): Promise<boolean> {
  if (!Number.isFinite(stopBy)) {
    await work;
    return true;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopped = new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), Math.max(0, stopBy - now())); });
  try {
    return await Promise.race([work.then(() => true as const), stopped]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The network half of a scan, one step of it. Asks every (prompt, run,
 * engine) not yet saved for this scan, reads each answer (extractor, judge,
 * tone rater) as soon as it is back, and saves it to `scan_answers` straight
 * away, so a step that runs out of time loses only the calls still in flight.
 *
 * Engine calls go through a small pool, since a scan is a few hundred slow
 * requests. Reading an answer happens outside that pool, so the next engine
 * request starts without waiting for the reading of the last one.
 *
 * Once every task has an answer, anything that failed on a rate limit or a
 * flaky connection gets one more try, after a pause. A bad key or a bad
 * request won't fix itself, so those aren't retried.
 *
 * No new call starts after `startBy`; at `stopBy` the step stops waiting.
 * Returns `done: true` when nothing is left to ask, so the scan can finish.
 * The website check and Google's AI Overviews run alongside the first step
 * and are written to the scan row; a failure only loses the check.
 */
export async function gatherStep(
  db: Db,
  scanId: string,
  adapters: EngineAdapter[],
  judge: Judge,
  extractor: Extractor,
  options: StepOptions,
): Promise<{ done: boolean }> {
  const now = options.now ?? Date.now;
  const concurrency = options.concurrency ?? Math.max(MIN_CONCURRENCY, adapters.length);
  const retryDelays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const [scan] = await db.select().from(scans).where(eq(scans.id, scanId));

  try {
    const { practice, promptRows, competitorRows, factRows, practiceNames } = await loadScanContext(db, scan.practiceId);
    const knownAtStart = competitorRows.filter(c => c.status === "active").map(c => c.name);
    const judgeFacts = factRows.map(f => ({ label: f.label, value: f.value, category: f.category }));
    // Any answer that really names the business can state a wrong fact about
    // it, not just the ones where the question named it. A branded answer
    // that only echoes the name back ("I couldn't find anything about X")
    // has nothing to check, so it is not judged and cannot push the fact
    // score toward 100. Nothing to check against without a fact sheet, so
    // then nothing is judged (fact score N/A).
    const shouldJudge = (kind: PromptRow["kind"], answer: string, mention: MentionKind) =>
      judgeFacts.length > 0 && !!answer && (kind === "branded" ? mention !== "echo" : mention === "named");
    // What the rater is told about the business, so it can tell this one
    // from a namesake in another city or trade.
    const context = { category: practice.category, location: practice.location, website: practice.website };
    const tasks = buildTasks(promptRows, scan.runs, adapters);
    if (scan.totalTasks == null) await db.update(scans).set({ totalTasks: tasks.length }).where(eq(scans.id, scanId));
    type Task = (typeof tasks)[number];
    type Answer = Awaited<ReturnType<EngineAdapter["run"]>>;
    const loadSaved = async () => new Map(
      (await db.select().from(scanAnswers).where(eq(scanAnswers.scanId, scanId)))
        .map(a => [taskKey(a.promptId, a.run, a.engine), a]),
    );
    let saved = await loadSaved();

    // Independent of the engines, so they run while the engines answer, in
    // any step that still has questions to ask and no result for them yet.
    // Buyer questions only for the overviews: a question that names the
    // business is not how anyone finds it. Uses the competitors known when
    // the scan starts.
    const buyerQuestions = promptRows.filter(p => p.kind !== "branded").map(p => p.text);
    const asking = tasks.some(t => !saved.has(taskKey(t.prompt.id, t.run, t.adapter.name)));
    const sideChecks = Promise.all([
      asking && scan.websiteCheck === null && options.checkWebsite && practice.website
        ? options.checkWebsite(practice.website, undefined, { names: practiceNames })
            .then(websiteCheck => websiteCheck && db.update(scans).set({ websiteCheck }).where(eq(scans.id, scanId)))
        : null,
      asking && scan.aiOverviews === null && options.checkAiOverviews && buyerQuestions.length > 0
        ? options.checkAiOverviews({ questions: buyerQuestions, practiceNames, competitorNames: knownAtStart })
            .then(aiOverviews => aiOverviews && db.update(scans).set({ aiOverviews }).where(eq(scans.id, scanId)))
        : null,
    ]).catch(() => undefined);
    const wrapUp = async (done: boolean) => {
      await settleBy(sideChecks, options.stopBy, now);
      await db.update(scans).set({ updatedAt: new Date() }).where(eq(scans.id, scanId));
      return { done };
    };

    const review = limiter(REVIEW_CONCURRENCY);

    // Reads one answer. Never throws: each call that can fail settles to
    // "no result", which the record phase logs.
    const read = async ({ prompt, run, adapter }: Task, result: Answer): Promise<Gathered> => {
      const { answer, citations } = result;
      const searchQueries = result.searchQueries ?? [];
      const rater = options.rateTone;
      // The extractor goes first so the pre-filter below knows every business
      // the answer names: "Harbor Plumbing and Rose City Plumbing are both
      // good" is two businesses only once Rose City Plumbing is a known name.
      // It gets a second try, because without its list a business named next
      // to ours can be read as one longer name and the mention lost.
      const extract = () => extractor({ answer, businessNames: practiceNames, knownCompetitors: knownAtStart });
      const discovered = await extract().catch(extract).catch(() => null);
      // The cheap pre-filter. The record phase repeats the analysis against
      // the reconciled competitor list and may still find the business absent.
      const mention = mentionKind(answer, practiceNames, [...knownAtStart, ...(discovered ?? []).map(canonicalName)]);

      const [judged, tone] = await Promise.all([
        shouldJudge(prompt.kind, answer, mention)
          ? withRetry(() => judge({ answer, facts: judgeFacts }), retryDelays).catch(() => null)
          : Promise.resolve(undefined),
        rater && mention === "named"
          ? rater({ answer, businessNames: practiceNames, context }).catch(() => null)
          : Promise.resolve(null),
      ]);
      return { prompt, run, adapter, ok: true, answer, citations, searchQueries, tone, discovered, judged };
    };

    for (;;) {
      const pending = tasks.filter(t => !saved.has(taskKey(t.prompt.id, t.run, t.adapter.name)));
      const retrying = pending.length === 0;
      const list = retrying
        ? tasks.filter(t => {
            const s = saved.get(taskKey(t.prompt.id, t.run, t.adapter.name))!;
            return !s.ok && s.retriable && s.attempts < 2;
          })
        : pending;
      if (list.length === 0) return await wrapUp(true);

      if (retrying) {
        // Longer than a rate-limit window, with jitter so practices scanning
        // at the same time don't all come back at the same second. A step
        // without time for the pause leaves the retries to the next one.
        const pause = options.finalRetryDelayMs ?? 30_000 + Math.random() * 30_000;
        // On the last chance there is no later step, so retries without time
        // for the pause are dropped and the scan settles on what came back.
        if (now() + pause > options.startBy) return await wrapUp(!!options.lastChance);
        await sleep(pause);
      } else if (!options.lastChance && now() > options.startBy) {
        return await wrapUp(false);
      }

      const save = async ({ prompt, run, adapter }: Task, g: Gathered) => {
        const row = g.ok
          ? {
              ok: true, retriable: false, answer: g.answer, citations: g.citations, searchQueries: g.searchQueries,
              tone: g.tone, discovered: g.discovered, judged: g.judged === undefined ? null : { result: g.judged },
            }
          : { ok: false, retriable: g.retriable };
        if (retrying) {
          await db.update(scanAnswers).set({ ...row, attempts: 2 }).where(and(
            eq(scanAnswers.scanId, scanId), eq(scanAnswers.promptId, prompt.id),
            eq(scanAnswers.run, run), eq(scanAnswers.engine, adapter.name),
          ));
        } else {
          // A late write from a call an earlier step gave up on is a no-op.
          await db.insert(scanAnswers)
            .values({ scanId, promptId: prompt.id, run, engine: adapter.name, ...row })
            .onConflictDoNothing();
        }
      };

      // Asks the engine, inside the pool, and hands back the reading and
      // saving of its answer still in progress so the lane is free for the
      // next ask. A call not started in time is left for a later step, or
      // counts as failed on the last chance.
      const pastStart = () => now() > options.startBy;
      const ask = async (task: Task): Promise<{ read: Promise<void> }> => {
        const failed = (retriable: boolean) => ({ read: save(task, { ...task, ok: false, retriable }) });
        if (pastStart()) return options.lastChance ? failed(false) : { read: Promise.resolve() };
        try {
          const result = await withRetry(() => task.adapter.run(task.prompt.text), retryDelays, () => !pastStart());
          return { read: review(() => read(task, result)).then(g => save(task, g)) };
        } catch (err) {
          return failed(isRetriable(err));
        }
      };
      const work = mapPool(list, concurrency, ask).then(asked => Promise.all(asked.map(a => a.read)));
      if (!(await settleBy(work, options.stopBy, now))) return await wrapUp(false);
      saved = await loadSaved();
    }
  } catch (err) {
    await db.update(scans).set({ status: "failed" }).where(eq(scans.id, scanId));
    throw err;
  }
}

/**
 * The record half of a scan, once `gatherStep` says it is done: rebuilds
 * every answer from `scan_answers` and records checks, findings and scores.
 *
 * It walks the answers in a fixed order and does every database write and
 * competitor reconciliation sequentially, so the outcome doesn't depend on
 * which request happened to finish first.
 *
 * One name analysis drives everything stored: `mentioned` is
 * `position !== "absent"` from `classifyPosition`, so a check can never say
 * named with position absent. The gather step only pre-filters the judge and
 * the rater on the cheaper `mentionKind`; a judge result for an answer this
 * phase then finds absent (or vetoes as a namesake, see `namesakeVeto`) is
 * discarded: not counted as judged, no findings opened.
 *
 * Each answer went through the competitor extractor, so the practice is
 * ranked against every business the engine actually recommended, not only
 * the ones the operator typed in. Newly discovered names are saved to the
 * practice's competitor list (source 'discovered').
 *
 * A failing engine, judge, or extractor call is logged as an activity warning
 * and the scan continues, because a partial scan is still a scan. Any
 * *unexpected* error marks the scan `failed` before rethrowing.
 *
 * Also returns the findings this scan newly opened, so the weekly cron can
 * send the internal accuracy alert without re-deriving "new" from the full
 * open-findings list.
 */
export async function finishScan(
  db: Db,
  scanId: string,
  engines: EngineName[],
  options: Pick<ScanOptions, "rateTone">,
): Promise<ScanResult> {
  const [scan] = await db.select().from(scans).where(eq(scans.id, scanId));
  const { practiceId, runs } = scan;

  try {
    const { practice, promptRows, competitorRows, factRows, practiceNames } = await loadScanContext(db, practiceId);
    // Grows during the record phase as discoveries are reconciled, so a
    // competitor found in one answer is matched by plain name detection in
    // every later one.
    let competitorNames = competitorRows.filter(c => c.status === "active").map(c => c.name);
    const ignoredNames = competitorRows.filter(c => c.status === "ignored").map(c => c.name);
    const judgeFacts = factRows.map(f => ({ label: f.label, value: f.value, category: f.category }));

    const saved = new Map(
      (await db.select().from(scanAnswers).where(eq(scanAnswers.scanId, scanId)))
        .map(a => [taskKey(a.promptId, a.run, a.engine), a]),
    );
    const gathered: Gathered[] = buildTasks(promptRows, runs, engines.map(name => ({ name }))).map(task => {
      const s = saved.get(taskKey(task.prompt.id, task.run, task.adapter.name));
      if (!s || !s.ok) return { ...task, ok: false, retriable: s?.retriable ?? false };
      return {
        ...task, ok: true, answer: s.answer ?? "", citations: s.citations, searchQueries: s.searchQueries,
        tone: s.tone ?? null, discovered: s.discovered ?? null,
        judged: s.judged === null ? undefined : s.judged.result,
      };
    });

    for (const g of gathered) {
      if (!g.ok) await logActivity(db, practiceId, `scan warning: ${g.adapter.name} failed on prompt ${g.prompt.text}`);
    }

    // A scan missing too many answers would publish a number built from a
    // fraction of what it claims. It is recorded as blocked and nothing else,
    // so every client surface keeps showing the last complete scan.
    const coverage = summarizeCoverage(gathered.map(g => ({ engine: g.adapter.name, ok: g.ok })));
    if (coverage.blocked) {
      await db.update(scans).set({ status: "blocked", coverage, finishedAt: new Date() })
        .where(and(eq(scans.id, scan.id), eq(scans.status, "running")));
      await logActivity(db, practiceId, `scan blocked: ${blockedReason(coverage)}`);
      return { scanId: scan.id, score: null, newFindings: [], blocked: true, coverage };
    }

    // --- Record phase --------------------------------------------------
    const scoringChecks: (ScoringCheck & { run: number })[] = [];
    let judgedCheckCount = 0;
    // One entry per wrong fact seen this scan, however many answers repeated it.
    const seenThisScan = new Map<string, {
      claim: string; factId: string | null; factValue: string | null;
      severity: NewFinding["severity"]; checkId: string; engine: string; prompt: string;
    }>();
    const factIdByLabel = new Map(factRows.map(f => [f.label, f.id]));
    const confirmedIds = (g: Gathered) => g.ok && g.judged
      ? [...new Set(g.judged.right.map(l => factIdByLabel.get(l)).filter((id): id is string => !!id))]
      : [];

    for (const g of gathered) {
      const { prompt, adapter } = g;
      if (!g.ok) continue;

      const { answer, citations } = g;

      if (g.discovered === null) {
        await logActivity(
          db, practiceId,
          `scan warning: competitor extraction failed on prompt ${prompt.text} (${adapter.name})`,
        );
      }
      // Only names that literally appear in the answer are kept: a
      // paraphrase ("Nurse Jamie's practice") or an invented name would
      // never be matched by name detection anyway, and would sit in the
      // competitor list as junk. Competitor names are matched without echo
      // detection: "I couldn't find anything about X, try Roto-Rooter"
      // names Roto-Rooter.
      const discoveredNames = (g.discovered ?? []).map(canonicalName);
      const verbatim = (g.discovered ?? []).filter(name => findMatches(
        answer, [canonicalName(name)],
        [...practiceNames, ...competitorNames, ...discoveredNames.filter(n => n !== canonicalName(name))],
      ).length > 0);
      const reconciled = reconcileCompetitors({
        known: competitorNames, ignored: ignoredNames, discovered: verbatim, practiceNames,
      });
      if (reconciled.newlyDiscovered.length > 0) {
        await db.insert(competitors).values(
          reconciled.newlyDiscovered.map(name => ({ practiceId, name, source: "discovered" })),
        );
        competitorNames = reconciled.all;
      }

      // One analysis drives `mentioned` and `position` alike, so a check can
      // never be stored as named with position absent: when a longer
      // competitor span swallows the business's, both say absent.
      let placed = classifyPosition(answer, practiceNames, competitorNames);
      let tone: ToneRating | null = placed.position === "absent" ? null : g.tone;
      let toneReason = tone?.reason ?? null;

      // The namesake guard: the rater says the answer describes another
      // business with this name, and the answer bears it out. The check is
      // then recorded as if the business were absent, because it is.
      // The guard is told the same competitor names as classifyPosition, so
      // "<namesake> and <competitor>" is two businesses for both.
      const namesake = placed.position === "absent"
        ? null
        : namesakeVeto({ answer, practiceNames, location: practice.location, rating: g.tone, others: competitorNames });
      if (namesake !== null) {
        // Only the business is taken out of the ranking; the competitors the
        // same analysis found stay. Re-running the matcher without the
        // practice names would lose "Roto-Rooter" in "Roto-Rooter and Harbor
        // Plumbing", since the longer-name guard would no longer know the
        // word after "and" starts a business. classifyPosition stores the
        // practice under practiceNames[0], so that is the entry removed.
        placed = {
          position: "absent",
          competitorsMentioned: placed.competitorsMentioned,
          namedOrder: placed.namedOrder.filter(n => n !== practiceNames[0]),
        };
        tone = null;
        toneReason = `Different business: ${namesake}`;
        await logActivity(
          db, practiceId,
          `namesake: ${adapter.name} described a different ${practice.name} on prompt ${prompt.text} (${namesake})`,
        );
      }
      const { position, competitorsMentioned, namedOrder } = placed;
      const mentioned = position !== "absent";
      // A judge result is discarded (not counted, no findings, nothing
      // confirmed) when the answer turned out not to be about the business:
      // a vetoed namesake, or an earned-prompt answer the record phase found
      // absent. A branded answer is judged even when it never names them.
      const discarded = namesake !== null || (prompt.kind !== "branded" && !mentioned);

      const [check] = await db.insert(checks).values({
        scanId: scan.id,
        promptId: prompt.id,
        engine: adapter.name,
        run: g.run,
        answerText: answer,
        citations,
        searchQueries: g.searchQueries,
        tone: tone?.tone ?? null,
        toneReason,
        mentioned,
        position,
        competitorsMentioned,
        namedOrder,
        factsConfirmed: discarded ? [] : confirmedIds(g),
      }).returning();

      scoringChecks.push({ engine: adapter.name, promptKind: prompt.kind, mentioned, position, run: g.run });

      // The pre-filter can miss a name the record phase then finds, when the
      // extractor call for this answer failed or left out a competitor that
      // an earlier answer had already added: "Harbor Plumbing and Rose City
      // Plumbing" is one longer name until Rose City is known. The row is
      // stored as named, correctly, but the judge and the rater never ran
      // on it, so the operator is told rather than left to find a named
      // answer with no fact check and no tone.
      if (mentioned && !discarded && prompt.kind !== "branded") {
        const gaps = [
          ...(judgeFacts.length > 0 && g.judged === undefined ? ["not fact-checked"] : []),
          ...(options.rateTone && g.tone === null ? ["not rated"] : []),
        ];
        if (gaps.length > 0) {
          await logActivity(
            db, practiceId,
            `scan warning: ${adapter.name} named the business on prompt ${prompt.text} but the answer was ${gaps.join(" and ")}`,
          );
        }
      }

      if (discarded || g.judged === undefined) continue;
      if (g.judged === null) {
        await logActivity(db, practiceId, `scan warning: judge failed on prompt ${prompt.text}`);
        continue;
      }

      // Only answers the judge actually scored count as checked: a judge
      // failure means "unknown", not "clean".
      judgedCheckCount++;

      for (const finding of g.judged.wrong) {
        const matchedFact = finding.factLabel ? factRows.find(f => f.label === finding.factLabel) : undefined;
        const key = findingKey({ factId: matchedFact?.id, claim: finding.claim });
        const prior = seenThisScan.get(key);
        if (prior) {
          prior.severity = worseSeverity(prior.severity, finding.severity);
          continue;
        }
        seenThisScan.set(key, {
          claim: finding.claim, factId: matchedFact?.id ?? null, factValue: matchedFact?.value ?? null,
          severity: finding.severity, checkId: check.id, engine: adapter.name, prompt: prompt.text,
        });
      }
    }

    // Reconcile this scan's wrong facts with the practice's history. An open
    // finding for the same fact is the same mistake seen again; a dismissed one
    // was ruled "not actually wrong" and stays that way; a fixed or verified
    // one that comes back is a new mistake.
    const priorFindings = await db.select().from(findings).where(eq(findings.practiceId, practiceId));
    const priorByKey = new Map<string, (typeof priorFindings)[number][]>();
    for (const f of priorFindings) {
      const key = findingKey(f);
      priorByKey.set(key, [...(priorByKey.get(key) ?? []), f]);
    }
    const newFindings: NewFinding[] = [];
    const linked = new Set<string>();
    for (const [key, seen] of seenThisScan) {
      const history = priorByKey.get(key) ?? [];
      if (history.some(f => f.status === "dismissed")) continue;
      // Findings saved before judge labels matched carry no fact, so they key
      // on their wording. Match those by claim too, and link them to the fact.
      const legacy = seen.factId
        ? priorFindings.find(f => f.status === "open" && !f.factId && !linked.has(f.id)
            && normalizeClaim(f.claim) === normalizeClaim(seen.claim))
        : undefined;
      const open = history.find(f => f.status === "open") ?? legacy;
      if (open) {
        if (open === legacy) linked.add(open.id);
        await db.update(findings)
          .set({
            lastSeenScanId: scan.id, severity: worseSeverity(open.severity, seen.severity),
            ...(open === legacy ? { factId: seen.factId ?? undefined, factValue: seen.factValue ?? undefined } : {}),
          })
          .where(eq(findings.id, open.id));
        continue;
      }
      await db.insert(findings).values({
        practiceId, checkId: seen.checkId, factId: seen.factId ?? undefined, claim: seen.claim,
        factValue: seen.factValue ?? undefined, severity: seen.severity, status: "open", lastSeenScanId: scan.id,
      });
      newFindings.push({ claim: seen.claim, factValue: seen.factValue, severity: seen.severity, engine: seen.engine, prompt: seen.prompt });
    }

    // A fix the operator marked "fixed" is confirmed by the first scan that
    // does not see the mistake again (see confirmedByScan for the guards).
    // The resolved date stays the day it was fixed.
    const confirmed = confirmedByScan(priorFindings, [...seenThisScan.values()], judgedCheckCount);
    if (confirmed.length > 0) {
      await db.update(findings).set({ status: "verified" }).where(inArray(findings.id, confirmed));
      await logActivity(
        db, practiceId,
        `Confirmed ${confirmed.length} fix${confirmed.length === 1 ? "" : "es"}: AI no longer repeats ${confirmed.length === 1 ? "it" : "them"}`,
        "client",
      );
    }

    // Only wrong facts seen in this scan cost points or cap the overall.
    const seenFindings = await db.select({ severity: findings.severity, category: facts.category })
      .from(findings)
      .leftJoin(facts, eq(findings.factId, facts.id))
      .where(and(eq(findings.practiceId, practiceId), eq(findings.status, "open"), eq(findings.lastSeenScanId, scan.id)));

    const factScore = computeFactScore({ judgedChecks: judgedCheckCount, openFindings: seenFindings });
    const hasCritical = seenFindings.some(f => f.severity === "critical");
    // Reach is out of the engines that actually answered: an engine that was
    // down didn't decline to name the client, it just wasn't heard from.
    const engineCount = new Set(gathered.filter(g => g.ok).map(g => g.adapter.name)).size || engines.length;
    const overallFor = (subset: ScoringCheck[]) =>
      computeOverall({ visibility: computeVisibility(subset, engineCount), factScore, hasCritical }).score;

    const visibility = computeVisibility(scoringChecks, engineCount);
    const parts = computeVisibilityParts(scoringChecks, engineCount);
    const score = computeOverall({ visibility, factScore, hasCritical }).score;
    const band = runs > 1
      ? scoreBand(Array.from({ length: runs }, (_, r) => scoringChecks.filter(c => c.run === r + 1))
          .filter(subset => subset.length > 0)
          .map(overallFor))
      : { low: score, high: score };

    await db.update(scans).set({
      status: "complete",
      score,
      citationRate: pct(parts.citationRate),
      positionScore: pct(parts.positionQuality),
      breadthScore: pct(parts.engineBreadth),
      visibilityScore: visibility,
      factScore,
      scoreLow: band.low,
      scoreHigh: band.high,
      coverage,
      finishedAt: new Date(),
    }).where(and(eq(scans.id, scan.id), eq(scans.status, "running")));

    const mentionedCount = scoringChecks.filter(c => c.mentioned).length;
    const range = runs > 1 && band.low !== null ? `, ${band.low}-${band.high} across ${runs} runs` : "";
    // The only automatic entry the client sees. Every other logActivity() call
    // in this file is a warning, and warnings stay internal.
    await logActivity(
      db, practiceId,
      `Weekly scan complete: score ${score} (${mentionedCount}/${scoringChecks.length} checks cited${range})`,
      "client",
    );

    // Keep the forecast this scan produces, so it can be checked against real
    // results later. Never worth failing a finished scan over.
    await saveForecastSnapshot(db, practiceId).catch(() => false);

    return { scanId: scan.id, score, newFindings, blocked: false, coverage };
  } catch (err) {
    await db.update(scans).set({ status: "failed" }).where(eq(scans.id, scanId));
    throw err;
  }
}

/**
 * Runs one full monitoring scan for a practice in a single call: asks every
 * active prompt of every adapter `runs` times, then records the checks,
 * findings and scores. See `gatherStep` and `finishScan`. Calls not started
 * by `options.deadline` count as failed.
 */
export async function runScan(
  db: Db,
  practiceId: string,
  adapters: EngineAdapter[],
  judge: Judge,
  extractor: Extractor,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const scanId = await startScan(db, practiceId, { runs: options.runs ?? 1, purpose: "manual" });
  const { done } = await gatherStep(db, scanId, adapters, judge, extractor, {
    ...options, startBy: options.deadline ?? Number.POSITIVE_INFINITY, stopBy: Number.POSITIVE_INFINITY, lastChance: true,
  });
  if (!done) throw new Error("scan did not settle");
  return finishScan(db, scanId, adapters.map(a => a.name), options);
}
