import type { ComponentType } from "react";
import type { PageProps } from "@/report/components";
import { CoverPage } from "@/report/pages/master-cover";
import { SummaryPage } from "@/report/pages/master-summary";
import { ScoreToolsPage } from "@/report/pages/master-score-tools";
import { CompetitorsPage } from "@/report/pages/master-competitors";
import { WinsTonePage } from "@/report/pages/master-wins-tone";
import { SourcesPage } from "@/report/pages/master-sources";
import { SearchesPage } from "@/report/pages/master-searches";
import { WrongFactsPage } from "@/report/pages/master-wrong-facts";
import { WebsitePage } from "@/report/pages/master-website";
import { PlanPage } from "@/report/pages/master-plan";
import { MethodPage } from "@/report/pages/master-method";
import { NextPage } from "@/report/pages/master-next";
import { VCoverPage } from "@/report/pages/v-cover";
import { VSummaryPage } from "@/report/pages/v-summary";
import { VToolsTonePage } from "@/report/pages/v-tools-tone";
import { VQuestionsPage } from "@/report/pages/v-questions";
import { VSourcesNextPage } from "@/report/pages/v-sources-next";
import { FCoverPage } from "@/report/pages/f-cover";
import { FTrueFalsePage } from "@/report/pages/f-true-false";
import { FWrongFactsPage } from "@/report/pages/f-wrong-facts";
import { FFixPage } from "@/report/pages/f-fix";

/** Page id (from `variantPages` in scoring.ts) -> component. */
import { OnePageSummaryPage } from "./one-page-summary";

export const PAGE_COMPONENTS: Record<string, ComponentType<PageProps>> = {
  cover: CoverPage,
  summary: SummaryPage,
  score_and_tools: ScoreToolsPage,
  competitors: CompetitorsPage,
  wins_and_tone: WinsTonePage,
  sources: SourcesPage,
  searches: SearchesPage,
  wrong_facts: WrongFactsPage,
  website_check: WebsitePage,
  action_plan: PlanPage,
  method: MethodPage,
  next_step: NextPage,
  v_cover: VCoverPage,
  v_summary: VSummaryPage,
  v_tools_tone: VToolsTonePage,
  v_questions_wins: VQuestionsPage,
  v_sources_next: VSourcesNextPage,
  f_cover: FCoverPage,
  f_true_false: FTrueFalsePage,
  f_wrong_facts: FWrongFactsPage,
  f_fix: FFixPage,
  one_page: OnePageSummaryPage,
};
