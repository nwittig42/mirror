import { after } from "next/server";
import { getDb } from "@/db";
import { loadEnv } from "@/lib/env";
import { getAdapters } from "@/engines";
import { fetchSitePages, draftFactsFromPages } from "@/services/fact-drafter";
import { draftQuestionsFromPages } from "@/services/question-drafter";
import { judgeAnswer } from "@/services/hallucination-judge";
import { extractCompetitors } from "@/services/competitor-extractor";
import { rateTone } from "@/services/tone-rater";
import { runWebsiteCheck } from "@/services/website-check";
import { fetchLogo } from "@/services/logo";
import { aiOverviewCheck } from "@/services/ai-overviews";
import { runScan, SCAN_DEADLINE_MS } from "@/services/scan-runner";
import { sendProspectAlert } from "@/services/alert-email";
import { prepareProspect } from "@/services/prospect-setup";
import { sendProspectReportFor } from "@/services/prospect-audit-email";

/**
 * Starts a new lead's setup after the booking response has gone out, with the
 * real website reader, drafters, engines and email. Runs inside the /book
 * page's time budget (see its maxDuration).
 */
export function startProspectSetup(leadId: string): void {
  after(async () => {
    const env = loadEnv();
    await prepareProspect(getDb(), leadId, {
      fetchPages: website => fetchSitePages(website),
      fetchLogo: website => fetchLogo(website),
      draftFacts: args => draftFactsFromPages(args),
      draftQuestions: args => draftQuestionsFromPages(args),
      scan: (db, practiceId) => runScan(db, practiceId, getAdapters(), judgeAnswer, extractCompetitors, {
        runs: env.SCAN_RUNS, rateTone, checkWebsite: runWebsiteCheck, checkAiOverviews: aiOverviewCheck(), deadline: Date.now() + SCAN_DEADLINE_MS,
      }),
      notify: args => sendProspectAlert(args),
      sendAudit: (db, practiceId, lead) => sendProspectReportFor(db, practiceId, lead),
    }).catch(err => console.error(`prospect setup failed for lead ${leadId}:`, err));
  });
}
