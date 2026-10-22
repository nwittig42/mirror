import { after } from "next/server";
import { getDb } from "@/db";
import { fetchSitePages, draftFactsFromPages } from "@/services/fact-drafter";
import { draftQuestionsFromPages } from "@/services/question-drafter";
import { fetchLogo } from "@/services/logo";
import { draftForecastSetup } from "@/services/forecast";
import { sendProspectAlert } from "@/services/alert-email";
import { prepareProspect } from "@/services/prospect-setup";
import { startScanChain } from "@/services/scan-chain";
import { liveStepDeps } from "@/services/scan-live";
import { sendProspectReportFor } from "@/services/prospect-audit-email";

/**
 * Starts a new lead's setup after the booking response has gone out, with the
 * real website reader, drafters, engines and email. Runs inside the /book
 * page's time budget (see its maxDuration); the scan's later steps run in
 * /api/cron/scan-step.
 */
export function startProspectSetup(leadId: string): void {
  const invokedAt = Date.now();
  after(async () => {
    await prepareProspect(getDb(), leadId, {
      fetchPages: website => fetchSitePages(website),
      fetchLogo: website => fetchLogo(website),
      draftFacts: args => draftFactsFromPages(args),
      draftQuestions: args => draftQuestionsFromPages(args),
      draftForecast: (db, practiceId) => draftForecastSetup(db, practiceId),
      // Runs as a chain of steps; the first counts the setup above against
      // its budget. The chain finishes the lead (see completionFor).
      scan: async (db, practiceId) => {
        await startScanChain(db, practiceId, "prospect", liveStepDeps("prospect", invokedAt));
        return "started";
      },
      notify: args => sendProspectAlert(args),
      sendAudit: (db, practiceId, lead) => sendProspectReportFor(db, practiceId, lead),
    }).catch(err => console.error(`prospect setup failed for lead ${leadId}:`, err));
  });
}
