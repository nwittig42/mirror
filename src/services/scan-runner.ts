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
import { logActivity } from "@/services/activity";

type Judge = typeof judgeAnswer;

type ScoringCheck = Pick<CheckResult, "engine" | "promptKind" | "mentioned" | "position">;

const pct = (fraction: number): number => Math.round(fraction * 100);

/**
 * Runs one full monitoring scan for a practice: fires every active prompt at
 * every adapter, records checks, audits branded checks for hallucinations via
 * the judge, computes the visibility score, and closes out the scan row.
 *
 * A failing engine or a failing judge call is logged as an activity warning
 * and the scan continues — a partial scan is still a scan. Any *unexpected*
 * error marks the scan `failed` before rethrowing.
 */
export async function runScan(
  db: Db,
  practiceId: string,
  adapters: EngineAdapter[],
  judge: Judge,
): Promise<{ scanId: string; score: number }> {
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
    const competitorNames = competitorRows.map(c => c.name);
    const judgeFacts = factRows.map(f => ({ label: f.label, value: f.value, category: f.category }));

    const scoringChecks: ScoringCheck[] = [];
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
        const { position, competitorsMentioned } = classifyPosition(answer, practiceNames, competitorNames);

        const [check] = await db.insert(checks).values({
          scanId: scan.id,
          promptId: prompt.id,
          engine: adapter.name,
          answerText: answer,
          citations,
          mentioned,
          position,
          competitorsMentioned,
        }).returning();

        scoringChecks.push({ engine: adapter.name, promptKind: prompt.kind, mentioned, position });

        if (prompt.kind === "branded" && check.answerText) {
          brandedCheckCount++;
          let judgeFindings;
          try {
            judgeFindings = await judge({ answer, facts: judgeFacts });
          } catch {
            await logActivity(db, practiceId, `scan warning: judge failed on prompt ${prompt.text}`);
            continue;
          }

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
    await logActivity(
      db, practiceId,
      `Weekly scan complete — score ${breakdown.score} (${mentionedCount}/${scoringChecks.length} checks cited)`,
    );

    return { scanId: scan.id, score: breakdown.score };
  } catch (err) {
    await db.update(scans).set({ status: "failed" }).where(eq(scans.id, scan.id));
    throw err;
  }
}
