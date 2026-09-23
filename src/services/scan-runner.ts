import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import {
  scans, checks, findings, prompts, nameVariations, competitors, facts, practices,
} from "@/db/schema";
import { detectMention } from "@/core/mention";
import { classifyPosition } from "@/core/position";
import { computeScore } from "@/core/scoring";
import type { CheckResult } from "@/core/types";
import type { EngineAdapter } from "@/engines/types";
import type { judgeAnswer } from "@/services/hallucination-judge";
import type { extractCompetitors } from "@/services/competitor-extractor";
import { canonicalName, reconcileCompetitors } from "@/core/competitors";
import { logActivity } from "@/services/activity";

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

/**
 * Runs one full monitoring scan for a practice: fires every active prompt at
 * every adapter, records checks, audits branded checks for hallucinations via
 * the judge, computes the visibility score, and closes out the scan row.
 *
 * Before ranking, each answer goes through the competitor extractor so the
 * practice is ranked against every business the engine actually recommended,
 * not only the ones the operator typed in. Newly discovered names are saved to
 * the practice's competitor list (source 'discovered') so later scans and the
 * admin screen see them.
 *
 * A failing engine, judge, or extractor call is logged as an activity warning
 * and the scan continues, because a partial scan is still a scan. Any *unexpected*
 * error marks the scan `failed` before rethrowing.
 *
 * Also returns the findings this scan newly opened, so the weekly cron can
 * send the internal accuracy alert without re-deriving "new" from the full
 * open-findings list.
 */
export async function runScan(
  db: Db,
  practiceId: string,
  adapters: EngineAdapter[],
  judge: Judge,
  extractor: Extractor,
): Promise<{ scanId: string; score: number; newFindings: NewFinding[] }> {
  const [scan] = await db.insert(scans).values({ practiceId }).returning();

  try {
    const [[practice], promptRows, variationRows, competitorRows, factRows] = await Promise.all([
      db.select().from(practices).where(eq(practices.id, practiceId)),
      db.select().from(prompts).where(and(eq(prompts.practiceId, practiceId), eq(prompts.active, true))),
      db.select().from(nameVariations).where(eq(nameVariations.practiceId, practiceId)),
      db.select().from(competitors).where(eq(competitors.practiceId, practiceId)),
      db.select().from(facts).where(and(eq(facts.practiceId, practiceId), eq(facts.status, "active"))),
    ]);

    const practiceNames = Array.from(new Set([practice.name, ...variationRows.map(v => v.text)]));
    // Grows during the scan as the extractor discovers names, so a competitor
    // found on prompt 1 is matched by plain name detection on prompts 2..10.
    let competitorNames = competitorRows.filter(c => c.status === "active").map(c => c.name);
    const ignoredNames = competitorRows.filter(c => c.status === "ignored").map(c => c.name);
    const judgeFacts = factRows.map(f => ({ label: f.label, value: f.value, category: f.category }));

    const scoringChecks: ScoringCheck[] = [];
    const newFindings: NewFinding[] = [];
    let brandedCheckCount = 0;
    let brandedChecksWithFinding = 0;

    for (const prompt of promptRows) {
      const settled = await Promise.allSettled(adapters.map(a => a.run(prompt.text)));

      for (let i = 0; i < adapters.length; i++) {
        const adapter = adapters[i];
        const result = settled[i];

        if (result.status === "rejected") {
          await logActivity(db, practiceId, `scan warning: ${adapter.name} failed on prompt ${prompt.text}`);
          continue;
        }

        const { answer, citations } = result.value;
        const mentioned = detectMention(answer, practiceNames);

        let discovered: string[] = [];
        try {
          discovered = await extractor({ answer, businessNames: practiceNames, knownCompetitors: competitorNames });
        } catch {
          await logActivity(
            db, practiceId,
            `scan warning: competitor extraction failed on prompt ${prompt.text} (${adapter.name})`,
          );
        }
        // Only names that literally appear in the answer are kept: a
        // paraphrase ("Nurse Jamie's practice") or an invented name would
        // never be matched by name detection anyway, and would sit in the
        // competitor list as junk.
        const verbatim = discovered.filter(name => detectMention(answer, [canonicalName(name)]));
        const reconciled = reconcileCompetitors({
          known: competitorNames, ignored: ignoredNames, discovered: verbatim, practiceNames,
        });
        if (reconciled.newlyDiscovered.length > 0) {
          await db.insert(competitors).values(
            reconciled.newlyDiscovered.map(name => ({ practiceId, name, source: "discovered" })),
          );
          competitorNames = reconciled.all;
        }

        const { position, competitorsMentioned, namedOrder } =
          classifyPosition(answer, practiceNames, competitorNames);

        const [check] = await db.insert(checks).values({
          scanId: scan.id,
          promptId: prompt.id,
          engine: adapter.name,
          answerText: answer,
          citations,
          mentioned,
          position,
          competitorsMentioned,
          namedOrder,
        }).returning();

        scoringChecks.push({ engine: adapter.name, promptKind: prompt.kind, mentioned, position });

        if (prompt.kind === "branded" && check.answerText) {
          let judgeFindings;
          try {
            judgeFindings = await judge({ answer, facts: judgeFacts });
          } catch {
            await logActivity(db, practiceId, `scan warning: judge failed on prompt ${prompt.text}`);
            continue;
          }

          // Only checks the judge actually scored count toward the accuracy
          // denominator. A judge failure means "unknown", not "clean", so
          // it must not silently inflate the accuracy component (see F3 in
          // the final review).
          brandedCheckCount++;

          if (judgeFindings.some(f => f.severity === "critical" || f.severity === "major")) {
            brandedChecksWithFinding++;
          }

          for (const finding of judgeFindings) {
            const existingOpen = await db.select().from(findings).where(and(
              eq(findings.practiceId, practiceId),
              eq(findings.claim, finding.claim),
              eq(findings.status, "open"),
            ));
            if (existingOpen.length > 0) continue;

            const matchedFact = finding.factLabel
              ? factRows.find(f => f.label === finding.factLabel)
              : undefined;

            await db.insert(findings).values({
              practiceId,
              checkId: check.id,
              factId: matchedFact?.id,
              claim: finding.claim,
              factValue: matchedFact?.value,
              severity: finding.severity,
              status: "open",
            });

            newFindings.push({
              claim: finding.claim,
              factValue: matchedFact?.value ?? null,
              severity: finding.severity,
              engine: adapter.name,
              prompt: prompt.text,
            });
          }
        }
      }
    }

    const openFindings = await db.select().from(findings).where(and(
      eq(findings.practiceId, practiceId),
      eq(findings.status, "open"),
    ));

    const breakdown = computeScore({
      checks: scoringChecks,
      openFindings: openFindings.map(f => ({ severity: f.severity })),
      brandedCheckCount,
      brandedChecksWithFinding,
    });

    await db.update(scans).set({
      status: "complete",
      score: breakdown.score,
      citationRate: pct(breakdown.citationRate),
      positionScore: pct(breakdown.positionQuality),
      breadthScore: pct(breakdown.engineBreadth),
      accuracyScore: pct(breakdown.accuracy),
      finishedAt: new Date(),
    }).where(eq(scans.id, scan.id));

    const mentionedCount = scoringChecks.filter(c => c.mentioned).length;
    // The only automatic entry the client sees. Every other logActivity() call
    // in this file is a warning, and warnings stay internal.
    await logActivity(
      db, practiceId,
      `Weekly scan complete: score ${breakdown.score} (${mentionedCount}/${scoringChecks.length} checks cited)`,
      "client",
    );

    return { scanId: scan.id, score: breakdown.score, newFindings };
  } catch (err) {
    await db.update(scans).set({ status: "failed" }).where(eq(scans.id, scan.id));
    throw err;
  }
}
