import type { ComponentType } from "react";
import type { PageProps } from "@/report/components";
import { OverviewPage } from "@/report/pages/master-overview";
import { ScoreToolsPage } from "@/report/pages/master-score-tools";
import { CompetitorsPage } from "@/report/pages/master-competitors";
import { WrongFactsPage } from "@/report/pages/master-wrong-facts";
import { SourcesPage } from "@/report/pages/master-sources";
import { PlanPage } from "@/report/pages/master-plan";
import { ClosingPage } from "@/report/pages/master-closing";
import { OnePageSummaryPage } from "@/report/pages/one-page-summary";

/** Page id (from `variantPages` in scoring.ts) -> component. */
export const PAGE_COMPONENTS: Record<string, ComponentType<PageProps>> = {
  overview: OverviewPage,
  score_and_tools: ScoreToolsPage,
  competitors: CompetitorsPage,
  wrong_facts: WrongFactsPage,
  sources: SourcesPage,
  action_plan: PlanPage,
  closing: ClosingPage,
  one_page: OnePageSummaryPage,
};
