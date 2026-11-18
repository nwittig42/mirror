import { after } from "next/server";
import { getDb } from "@/db";
import { fetchSitePages, draftFactsFromPages } from "@/services/fact-drafter";
import { draftQuestionsFromPages } from "@/services/question-drafter";
import { fetchLogo } from "@/services/logo";
import { prepareForecast } from "@/services/forecast";
import { sendProspectAlert } from "@/services/alert-email";
import { prepareProspect } from "@/services/prospect-setup";
import { startScanChain } from "@/services/scan-chain";
import { liveStepDeps } from "@/services/scan-live";
import { getAdapters } from "@/engines";
import { quickAdapters } from "@/services/quick-scan";
import { makeFullScanTrigger, quickLookFirst } from "@/services/full-scan-start";
import { loadEnv } from "@/lib/env";
import { sendProspectReportFor } from "@/services/prospect-audit-email";

/**
 * Starts a new lead's setup after the booking response has gone out, with the
 * real website reader, drafters, engines and email. Runs inside the /book
 * page's time budget (see its maxDuration). A quick look is scanned first; the
 * full audit that follows it starts in /api/cron/scan-start and its later
 * steps run in /api/cron/scan-step.
 */
export function startProspectSetup(leadId: string): void {
  const invokedAt = Date.now();
  after(async () => {
    await prepareProspect(getDb(), leadId, {
      fetchPages: website => fetchSitePages(website),
      fetchLogo: website => fetchLogo(website),
      draftFacts: args => draftFactsFromPages(args),
      draftQuestions: args => draftQuestionsFromPages(args),
      // Drafts the setup and buys the search numbers; a failed purchase is logged and the audit carries on.
      draftForecast: (db, practiceId) => prepareForecast(db, practiceId),
      // The quick look runs first, on a clock of its own that starts here,
      // and its end starts the full audit (see completionFor). With both
      // quick tools switched off there is no quick look: the full audit runs
      // as the only one, its first step counting the setup above.
      scan: async (db, practiceId) => {
        if (quickAdapters(getAdapters()).length === 0) {
          await startScanChain(db, practiceId, "prospect", liveStepDeps("prospect", invokedAt));
          return "started";
        }
        const env = loadEnv();
        return quickLookFirst(
          () => startScanChain(db, practiceId, "quick", liveStepDeps("quick", Date.now())),
          () => makeFullScanTrigger({
            appUrl: env.APP_URL, cronSecret: env.CRON_SECRET, bypassSecret: env.VERCEL_AUTOMATION_BYPASS_SECRET,
          })(practiceId),
        );
      },
      notify: args => sendProspectAlert(args),
      sendAudit: (db, practiceId, lead) => sendProspectReportFor(db, practiceId, lead),
    }).catch(err => console.error(`prospect setup failed for lead ${leadId}:`, err));
  });
}
