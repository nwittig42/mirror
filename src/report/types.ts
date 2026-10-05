/**
 * Mirror AI Visibility Audit — data model.
 *
 * One `AuditReport` object feeds all three report variants
 * (master, visibility snapshot, fact check). Store raw results here;
 * everything shown as a headline, color, percentage or sort order is
 * derived by the functions in `scoring.ts`, never stored.
 */

export type ToolId = 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'perplexity';

export type Level = 'low' | 'medium' | 'high';
export type Severity = 'critical' | 'major' | 'minor';
export type CheckStatus = 'pass' | 'warn' | 'fail';
export type PageStatus = 'have' | 'partial' | 'missing';

export type SourceType =
  | 'articles'
  | 'reviews_directories'
  | 'reddit_social'
  | 'own_website'
  | 'google'
  | 'reference';

export interface Business {
  name: string;           // "Glow MedSpa"
  website: string;        // "glowmedspa.com" (no protocol)
  location: string;       // "Santa Monica, CA"
  category: string;       // "Med spa"
}

export interface ScanInfo {
  date: string;                    // ISO date, "2026-09-24"
  tools: ToolId[];                 // assistants checked, in display order
  buyerQuestionCount: number;      // questions WITHOUT the business name (visibility)
  brandedQuestionCount: number;    // questions WITH the business name (fact accuracy)
  runsPerQuestion: number;         // 3
  coverageNote: string | null;     // "Based on 4 of 5 AI tools. Gemini didn't respond."; null = every tool answered
}

/** One ingredient of the overall score. Points earned = round(score * weight / 100). */
export interface ScoreComponent {
  id: 'named_often' | 'rank_high' | 'tool_reach' | 'accuracy';
  label: string;          // "How often you're named"
  definition: string;     // plain-English one-liner
  weight: number;         // max points out of 100; the parts always sum to 100
  score: number;          // 0–100 sub-score
  detail: string;         // "10 of 75 answers"
}

export interface Scores {
  overall: { value: number; min: number; max: number; explanation: string }; // min/max across runs
  visibility: number;           // 0–100
  factAccuracy: number | null;  // 0–100; null = nothing was fact-checked (show "N/A")
  components: ScoreComponent[];
}

export interface ToolResult {
  tool: ToolId;
  named: number;          // answers that named the client
  total: number;          // buyer answers from this tool (buyerQuestionCount * runsPerQuestion)
}

export interface LeaderboardEntry {
  name: string;
  count: number;          // buyer answers naming this business
  isClient: boolean;
}

export interface Competitor {
  name: string;
  visibility: number;     // 0–100 (accuracy is never measured for competitors)
  namedCount: number;
}

export interface GridCell {
  tool: ToolId;
  firstNamed: string;         // business named first most often across runs
  clientRank: number | null;  // client's typical spot; null = not named
  runsAppeared: number;       // 0..runsPerQuestion
}

export interface BuyerQuestion {
  id: string;
  text: string;
  cells: GridCell[];          // one per tool, same order as scan.tools
}

export interface ClosestWin {
  questionId: string;
  tool: ToolId;
  rank: 2 | 3;
  ahead: string[];            // businesses ranked above the client, in order
  runsAppeared: number;
}

export interface Tone {
  recommended: number;
  justListed: number;
  mixed: number;
  warnedAgainst: number;
}

export interface Quote {
  text: string;
  tool: ToolId;
  questionId?: string;
}

export interface SourceShare {
  type: SourceType;
  pct: number;                // share of all citations; all types sum to 100
}

export interface CitedSite {
  domain: string;
  type: SourceType;
}

export interface OutreachSite {
  domain: string;
  ask: string;                // what to ask the site for, one line
}

export interface Sources {
  types: SourceShare[];
  topSites: CitedSite[];              // most-cited overall, ranked
  competitorWinSites: OutreachSite[]; // cited when a competitor won — the outreach list
  ownSiteCitedPct: number;            // % of answers that cited the client's website
}

export interface SearchQuery {
  query: string;
  tools: ToolId[];
}

export interface PageWanted {
  word: string;               // "prices"
  page: string;               // "A current price list"
  why: string;
  status: PageStatus;
}

export interface Searches {
  queries: SearchQuery[];
  addedWords: string[];       // most-added first
  pagesWanted: PageWanted[];
}

export interface FactCheck {
  id: string;
  topic: string;              // "Botox price"
  isTrue: boolean;
  truth: string;              // the correct fact, confirmed by the client
  // Only when isTrue === false:
  aiSaid?: string;
  tool?: ToolId;              // assistant that said it
  severity?: Severity;
  isPrice?: boolean;
  sources?: string[];         // domains AI read it from; [] = not shown
  fix?: string;               // one-line fix
}

export interface WebsiteCheck {
  id: 'ai_allowed' | 'readable_text' | 'facts_page' | 'machine_labels' | 'sitemap' | string;
  label: string;
  why: string;
  fix?: string;               // required when status !== 'pass'
  status: CheckStatus;
}

export interface Action {
  id: string;
  title: string;
  why: string;
  fixes: string;              // "wrong Botox price (p. 08)"
  effort: Level;
  impact: Level;
  track: 'visibility' | 'facts' | 'both'; // which variant(s) show it
}

export interface PlanPhase {
  when: string;               // "Month 1"
  title: string;              // "Fix the facts"
  items: string[];
}

export interface Contact {
  name: string;
  email: string;
  phone?: string;
  bookingUrl: string;
}

export interface AuditReport {
  business: Business;
  scan: ScanInfo;
  scores: Scores;
  topCompetitor: Competitor;
  toolResults: ToolResult[];
  leaderboard: LeaderboardEntry[];
  questions: BuyerQuestion[];
  closestWins: ClosestWin[];
  tone: Tone;
  quotes: { best?: Quote; worst?: Quote };
  sources: Sources;
  searches: Searches;
  facts: FactCheck[];
  websiteChecks: WebsiteCheck[];
  actions: Action[];          // already in priority order
  topFixIds: string[];        // 3 action ids for the executive summary
  plan90: PlanPhase[];
  contact: Contact;
  /** A real buyer answer that named competitors and not the client: the proof that lands with an owner. */
  missedQuote?: { question: string; text: string; tool: ToolId; named: string[] };
  /**
   * Not a live customer yet (paused account): its facts were read off its
   * website and not reviewed, so fact scores and fact claims stay hidden.
   */
  prospect: boolean;
}
