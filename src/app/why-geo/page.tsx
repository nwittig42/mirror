import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import "../landing.css";
import { LandingCta, LandingFooter, LandingNav } from "@/components/landing/chrome";

/**
 * "Why invest in GEO?": the case for getting recommended by AI, made with
 * other people's numbers and drawn as charts. Public (see PUBLIC_PATHS in
 * src/middleware.ts) and static, like the other marketing pages.
 *
 * Every figure links to the study it came from (the STUDIES list, also
 * printed in full at the foot of the page) and comes from reports/GEO pricing
 * and case studies.md or reports/AI visibility lead forecast model.md, which
 * also record what must NOT be claimed. Three rules from those reports hold
 * on this page:
 *  - A company's result is "reported", with the company named and linked.
 *    Vendor-published cases say whose they are.
 *  - No promise of leads, customers or payback. The cost section compares
 *    prices; it does not say what Mirror will deliver.
 *  - The contested claim (AI visitors convert far better) is shown with the
 *    larger studies that disagree, not on its own.
 * Check both reports before adding a number.
 */

export const metadata: Metadata = {
  title: "Why invest in GEO · Mirror",
  description:
    "The case for getting recommended by AI, with every study linked: how many customers ask AI first, what a mention is worth, what companies have reported, and what it costs next to ads and agencies.",
};

/** Every study the page draws on. `name` is what the link says; `full` is its line in the source list. */
const STUDIES = {
  chatgptTimeline: { name: "ChatGPT timeline", full: "Search Engine Journal, Timeline of ChatGPT updates and key events (weekly user milestones)", href: "https://www.searchenginejournal.com/timeline-of-chatgpt-updates-key-events/556342/" },
  techcrunch: { name: "TechCrunch", full: "TechCrunch, ChatGPT doubled its weekly active users in under 6 months (March 2025)", href: "https://techcrunch.com/2025/03/06/chatgpt-doubled-its-weekly-active-users-in-under-6-months-thanks-to-new-releases" },
  altman: { name: "800M report", full: "AOL, Sam Altman touts ChatGPT's 800 million weekly users", href: "https://www.aol.com/articles/sam-altman-touts-chatgpts-800-091502060.html" },
  chatgpt900: { name: "TechCrunch, 900M", full: "TechCrunch, ChatGPT reaches 900M weekly active users (February 2026)", href: "https://techcrunch.com/2026/02/27/chatgpt-reaches-900m-weekly-active-users" },
  alphabet2025: { name: "Alphabet, 2025 results", full: "Alphabet, Q2 2025 earnings call remarks (Gemini app 450M monthly users, AI Mode 100M); Q3 2025 (650M) and Q4 2025 (750M) remarks are on the same site", href: "https://blog.google/inside-google/message-ceo/alphabet-earnings-q2-2025/" },
  alphabet2026: { name: "Alphabet, Q2 2026 results", full: "Alphabet, Q2 2026 earnings call remarks (Gemini app 950M monthly users, AI Mode over 1 billion)", href: "https://blog.google/company-news/inside-google/message-ceo/alphabet-earnings-q2-2026/" },
  metaAi: { name: "Meta results", full: "Meta, earnings call transcripts: Meta AI at more than 500 million monthly users (Q3 2024), more than 700 million (Q4 2024) and more than a billion (Q3 2025)", href: "https://s21.q4cdn.com/399680738/files/doc_financials/2024/q3/META-Q3-2024-Earnings-Call-Transcript.pdf" },
  metaAiBillion: { name: "TechCrunch, Meta AI", full: "TechCrunch, Meta AI now has 1B monthly active users (May 2025)", href: "https://techcrunch.com/2025/05/29/meta-ai-now-has-1b-monthly-active-users/" },
  copilot: { name: "Microsoft results", full: "Microsoft, earnings calls: Copilot family past 100 million monthly users (July 2025) and 150 million (October 2025), work and personal together", href: "https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q1" },
  perplexity: { name: "TechCrunch, Perplexity", full: "TechCrunch, Perplexity received 780 million queries last month, CEO says (June 2025)", href: "https://techcrunch.com/2025/06/05/perplexity-received-780-million-queries-last-month-ceo-says/" },
  zeroClick2024: { name: "SparkToro, 2024", full: "SparkToro, 2024 zero-click search study (Datos panel, US and EU)", href: "https://sparktoro.com/blog/2024-zero-click-search-study-for-every-1000-us-google-searches-only-374-clicks-go-to-the-open-web-in-the-eu-its-360/" },
  zeroClick2026: { name: "SparkToro, 2026", full: "SparkToro, In 2026, less than one-third of Google searches still send a click (Similarweb panel, also restates 2019)", href: "https://sparktoro.com/blog/in-2026-less-than-one-third-of-google-searches-still-send-a-click/" },
  ahrefsClicks: { name: "Ahrefs, 300,000 keywords", full: "Ahrefs, AI Overviews reduce clicks: December 2025 update (300,000 keywords, Search Console data)", href: "https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/" },
  chartbeat: { name: "Reuters Institute", full: "Reuters Institute, Journalism, media and technology trends and predictions 2026 (Chartbeat data, 2,576 sites)", href: "https://reutersinstitute.politics.ox.ac.uk/journalism-media-and-technology-trends-and-predictions-2026" },
  googleQueries: { name: "Google statement", full: "Google, statement on press reports about Search traffic (May 2025): overall query growth continues", href: "https://blog.google/products/search/statement-press-reports-about-search-traffic" },
  onelittleweb: { name: "OneLittleWeb study", full: "OneLittleWeb, AI chatbots vs search engines: a two-year study of web visits to the top 10 of each (Semrush estimates)", href: "https://onelittleweb.com/data-studies/ai-chatbots-vs-search-engines/" },
  pew: { name: "Pew Research", full: "Pew Research Center, Google users are less likely to click on links when an AI summary appears (68,879 searches)", href: "https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/" },
  ahrefsShare: { name: "Ahrefs analysis", full: "Ahrefs, ChatGPT has 12% of Google's search volume", href: "https://ahrefs.com/blog/chatgpt-has-12-percent-of-googles-search-volume/" },
  brightlocal: { name: "BrightLocal survey", full: "BrightLocal, Local Consumer Review Survey", href: "https://www.brightlocal.com/research/local-consumer-review-survey/" },
  yext: { name: "Yext study", full: "Yext, consumer search behaviors findings", href: "https://www.yext.com/resources/consumer-search-behaviors-findings" },
  bluehost: { name: "Bluehost survey", full: "Bluehost, State of Small Business AI Confidence (350 owners, May 2026)", href: "https://www.bluehost.com/state-of-small-business-ai-confidence" },
  profound: { name: "Profound study", full: "Profound, The AI Mention Effect (2 million AI conversations, July 2026)", href: "https://www.tryprofound.com/blog/the-ai-mention-effect" },
  similarweb: { name: "Similarweb study", full: "Similarweb, AI-recommended brands and site visits, reported by Search Engine Journal", href: "https://www.searchenginejournal.com/ai-recommended-brands-saw-2-5x-more-site-visits-similarweb/580241" },
  vercel: { name: "Vercel", full: "Vercel, How we're adapting SEO for LLMs and AI search", href: "https://vercel.com/blog/how-were-adapting-seo-for-llms-and-ai-search" },
  docebo: { name: "Growth Unhinged", full: "Growth Unhinged, The AI discovery playbook (Docebo)", href: "https://www.growthunhinged.com/p/ai-discovery-playbook" },
  webflow: { name: "Growth Unhinged", full: "Growth Unhinged, Traffic is no longer reliable (Webflow)", href: "https://www.growthunhinged.com/p/traffic-is-no-longer-reliable" },
  ahrefs: { name: "Ahrefs", full: "Ahrefs, AI search traffic and conversions at Ahrefs", href: "https://ahrefs.com/blog/ai-search-traffic-conversions-ahrefs/" },
  nursing: { name: "Profound case study", full: "Profound, Arizona College of Nursing customer story", href: "https://www.tryprofound.com/customers/arizona-college-of-nursing" },
  tally: { name: "Tally", full: "Tally, From $2M to $3M ARR", href: "https://blog.tally.so/from-2-to-3m-arr-how-we-bootstrapped-tally-with-a-tiny-team/" },
  soci: { name: "SOCi index", full: "SOCi, 2026 Local Visibility Index (350,000+ locations)", href: "https://golocal.soci.ai/rs/355-TUF-572/images/The_2026_Local_Visibility_Index_SOCi100.pdf?version=0" },
  searchable: { name: "Searchable study", full: "Searchable, AI inaccuracies about UK high street retailers, reported by Retail Focus", href: "https://retail-focus.co.uk/nearly-two-thirds-of-uk-high-street-retailers-suffer-from-ai-chatbot-inaccuracies/" },
  mongodb: { name: "Profound case study", full: "Profound, MongoDB customer story", href: "https://www.tryprofound.com/customers/mongodb" },
  localiq: { name: "LocaliQ benchmarks", full: "LocaliQ, Search advertising benchmarks, 2026", href: "https://localiq.com/blog/search-advertising-benchmarks/" },
  fps: { name: "First Page Sage report", full: "First Page Sage, GEO and AEO pricing statistics (1,146 quotes from 214 agencies, October 2026)", href: "https://firstpagesage.com/seo-blog/geo-aeo-pricing-statistics/" },
  princeton: { name: "Princeton-led paper", full: "Aggarwal et al., GEO: Generative Engine Optimization (arXiv 2311.09735)", href: "https://arxiv.org/abs/2311.09735" },
  amsive: { name: "Amsive study", full: "Amsive, LLM traffic conversion rate study (54 sites)", href: "https://www.amsive.com/insights/seo/llm-traffic-conversion-rate-study/" },
  sel: { name: "973-site study", full: "Search Engine Land, LLM and Google referral conversion study (973 sites)", href: "https://searchengineland.com/llms-google-referral-conversion-study-463747" },
} as const;

type StudyKey = keyof typeof STUDIES;

/** A link to one study, as a small pill. `tone` picks its colour. */
function Study({ k, tone = "gold" }: { k: StudyKey; tone?: Tone }) {
  return (
    <a className={`lp-why-study ${tone}`} href={STUDIES[k].href} target="_blank" rel="noopener noreferrer">
      {STUDIES[k].name} <span aria-hidden="true">↗</span>
    </a>
  );
}

type Tone = "gold" | "orange" | "pink" | "teal" | "plum" | "sun";

/** A horizontal bar, sized by `pct` (0 to 100), with its label and value. */
function Bar({ label, value, pct, tone, small }: { label: string; value: string; pct: number; tone: Tone; small?: string }) {
  return (
    <div className="lp-why-bar">
      <div className="top">
        <span>{label}{small && <small>{small}</small>}</span>
        <strong>{value}</strong>
      </div>
      <div className="track"><span className={tone} style={{ width: `${Math.max(1.5, pct)}%` }} /></div>
    </div>
  );
}

/** A ring filled to `pct`, with the number in the middle. */
function Donut({ pct, label, tone }: { pct: number; label: string; tone: Tone }) {
  return (
    <div className={`lp-why-donut ${tone}`} style={{ "--pct": pct } as CSSProperties} role="img" aria-label={label}>
      <span>{label}</span>
    </div>
  );
}

/**
 * People using each AI tool, in millions, as its own company announced them.
 * `month` counts from November 2023 so the chart's spacing is true to time.
 * The counts are not like for like (ChatGPT's is weekly, Google's are
 * monthly) and the same person can be in several, so they are drawn side by
 * side and never added up.
 */
const AI_TOOLS: { name: string; per: string; tone: Tone; points: { when: string; month: number; users: number }[] }[] = [
  { name: "ChatGPT", per: "a week", tone: "teal", points: [
    { when: "Nov 2023", month: 0, users: 100 }, { when: "Aug 2024", month: 9, users: 200 }, { when: "Dec 2024", month: 13, users: 300 },
    { when: "Feb 2025", month: 15, users: 400 }, { when: "Mar 2025", month: 16, users: 500 }, { when: "Oct 2025", month: 23, users: 800 },
    { when: "Feb 2026", month: 27, users: 900 },
  ] },
  { name: "Google Gemini app", per: "a month", tone: "sun", points: [
    { when: "Jul 2025", month: 20, users: 450 }, { when: "Oct 2025", month: 23, users: 650 },
    { when: "Feb 2026", month: 27, users: 750 }, { when: "Jul 2026", month: 32, users: 950 },
  ] },
  { name: "Google AI Mode", per: "a month", tone: "orange", points: [
    { when: "Jul 2025", month: 20, users: 100 }, { when: "Jul 2026", month: 32, users: 1000 },
  ] },
  { name: "Meta AI", per: "a month", tone: "plum", points: [
    { when: "Oct 2024", month: 11, users: 500 }, { when: "Jan 2025", month: 14, users: 700 },
    { when: "May 2025", month: 18, users: 1000 }, { when: "Oct 2025", month: 23, users: 1000 },
  ] },
  // Work and personal Copilot together: Microsoft gives no figure for either alone.
  { name: "Microsoft Copilot", per: "a month", tone: "pink", points: [
    { when: "Jul 2025", month: 20, users: 100 }, { when: "Oct 2025", month: 23, users: 150 },
  ] },
];

/**
 * The search-engine side of the same years: of every 100 Google searches in
 * the US, how many end in a click to a website (100 less SparkToro's
 * zero-click share). The number of searches has not fallen, so this is the
 * line that honestly slopes down. It is a share, not a count of people, so it
 * is read on its own scale on the right of the chart.
 */
const SEARCH_CLICKS = [
  { when: "May 2024", month: 6, pct: 41.5 },
  { when: "Apr 2026", month: 29, pct: 32 },
];

/** A count in millions as people say it: "900M", "1B". */
const people = (millions: number) => (millions >= 1000 ? `${+(millions / 1000).toFixed(1)}B` : `${millions}M`);

/** The rise of each AI tool's users as one line each, on a shared timeline, with a key that gives the latest figure. */
function GrowthChart() {
  const W = 640, H = 300, left = 44, right = 40, top = 16, bottom = 34;
  const months = 32, max = 1100;
  const x = (m: number) => left + (m / months) * (W - left - right);
  const y = (u: number) => top + (1 - u / max) * (H - top - bottom);
  // The right-hand scale: 50% sits level with 1B, 25% with 500M, 0% with 0.
  const yPct = (pct: number) => y(pct * 20);
  const clicksNow = SEARCH_CLICKS[SEARCH_CLICKS.length - 1];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="lp-why-growth" role="img"
        aria-label={`${AI_TOOLS.map(t => `${t.name}, users ${t.per}: ${t.points.map(p => `${p.when} ${people(p.users)}`).join(", ")}`).join(". ")}. Google searches that end in a click to a website: ${SEARCH_CLICKS.map(p => `${p.when} ${p.pct}%`).join(", ")}`}>
        {[0, 500, 1000].map(u => (
          <g key={u}>
            <line x1={left} x2={W - right} y1={y(u)} y2={y(u)} className={u === 0 ? "axis" : "grid"} />
            <text x={left - 8} y={y(u) + 4} textAnchor="end" className="when">{u === 0 ? "0" : people(u)}</text>
            <text x={W - right + 8} y={y(u) + 4} textAnchor="start" className="when">{u / 20}%</text>
          </g>
        ))}
        {/* January of each year: months 2, 14 and 26 after November 2023. */}
        {[[2, "2024"], [14, "2025"], [26, "2026"]].map(([m, year]) => (
          <text key={year} x={x(m as number)} y={H - 10} textAnchor="middle" className="when">{year}</text>
        ))}
        {AI_TOOLS.map(tool => (
          <g key={tool.name} className={tool.tone}>
            <path d={tool.points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.month).toFixed(1)} ${y(p.users).toFixed(1)}`).join(" ")} className="line" />
            {tool.points.map(p => <circle key={p.when} cx={x(p.month)} cy={y(p.users)} r={5} className="dot" />)}
          </g>
        ))}
        <g className="search">
          <path d={SEARCH_CLICKS.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.month).toFixed(1)} ${yPct(p.pct).toFixed(1)}`).join(" ")} className="line" />
          {SEARCH_CLICKS.map(p => (
            <g key={p.when}>
              <circle cx={x(p.month)} cy={yPct(p.pct)} r={5} className="dot" />
              <text x={x(p.month)} y={yPct(p.pct) - 12} textAnchor="middle" className="val">{p.pct}%</text>
            </g>
          ))}
        </g>
      </svg>
      <ul className="lp-why-key">
        {AI_TOOLS.map(tool => {
          const latest = tool.points[tool.points.length - 1];
          return (
            <li key={tool.name}>
              <i className={tool.tone} aria-hidden="true" />
              <span>{tool.name}</span>
              <strong>{people(latest.users)}</strong>
              <small>{tool.per}, {latest.when}</small>
            </li>
          );
        })}
        <li>
          <i className="search" aria-hidden="true" />
          <span>Google searches that end in a click</span>
          <strong>{clicksNow.pct}%</strong>
          <small>right-hand scale, {clicksNow.when}</small>
        </li>
      </ul>
    </div>
  );
}

const CASES: { who: string; n: string; what: string; study: StudyKey; tone: Tone; note?: string }[] = [
  { who: "Vercel", n: "1% → 10%", what: "of new signups from ChatGPT, six months apart.", study: "vercel", tone: "teal" },
  { who: "Docebo", n: "12.7%", what: "of high-intent leads named an AI tool. Five times the year before.", study: "docebo", tone: "orange" },
  { who: "Webflow", n: "10%", what: "of signups from AI discovery, up about 4x in a year.", study: "webflow", tone: "plum" },
  { who: "Ahrefs", n: "12.1%", what: "of signups from AI search, on only 0.5% of its traffic.", study: "ahrefs", tone: "pink", note: "One site, one month." },
  { who: "Arizona College of Nursing", n: "+51%", what: "AI-referred inquiries in 90 days, across 24 local campuses.", study: "nursing", tone: "sun", note: "Published by its vendor." },
  { who: "Tally", n: "#1", what: "ChatGPT became its top source of referrals.", study: "tally", tone: "gold", note: "No campaign was run." },
];

export default function WhyGeoPage() {
  return (
    <div className="mk lp-why">
      <LandingNav />

      <main style={{ flex: 1 }}>
        {/* ---------- the claim ---------- */}
        <section className="lp-section bone">
          <div className="lp-inner">
            <header className="lp-section-head center">
              <h1 className="lp-h2 big">
                Why invest in <span className="accent">GEO</span>
              </h1>
              <p className="lp-sub">
                Your customers are moving to AI for answers, and most businesses have not followed. Be an early mover: get your brand
                named first by ChatGPT, Gemini and the other large language models while your competitors wait. Here is the evidence, study by study.
              </p>
              <div className="lp-why-jump">
                <a className="teal" href="#search">AI chatbot visits up 81% in a year</a>
                <a className="pink" href="#search">68% of Google searches end without a click</a>
                <a className="sun" href="#shift">45% ask AI for a local business, up from 6%</a>
                <a className="orange" href="#intent">2.5x the visits when AI names you</a>
                <a className="plum" href="#shift">Only 13% of owners are acting</a>
              </div>
            </header>
          </div>
        </section>

        {/* ---------- 0. search is moving ---------- */}
        <section className="lp-section" id="search">
          <div className="lp-inner">
            <header className="lp-section-head">
              <span className="lp-eyebrow">Search is moving</span>
              <h2 className="lp-h2">
                People are moving from search engines <span className="accent">to AI for answers.</span>
              </h2>
            </header>
            <article className="lp-why-panel">
              <h3>AI tools rising, clicks from search falling</h3>
              <p className="sub">Each AI company&apos;s own count of its users, against the share of Google searches that end in a click</p>
              <GrowthChart />
              <div className="foot">
                <Study k="chatgptTimeline" tone="teal" /> <Study k="chatgpt900" tone="teal" /> <Study k="alphabet2025" tone="sun" /> <Study k="alphabet2026" tone="orange" />
                {" "}<Study k="metaAi" tone="plum" /> <Study k="metaAiBillion" tone="plum" /> <Study k="copilot" tone="pink" /> <Study k="perplexity" tone="gold" />
                {" "}<Study k="zeroClick2024" /> <Study k="zeroClick2026" />
                <span>
                  The dashed line is the search-engine side, on the right-hand scale: of every 100 Google searches in the US, how many
                  end in a click to a website. People still search as much; fewer searches lead anywhere. Its two points come from
                  different panels, so read the direction, not the exact drop.
                </span>
                <span>
                  ChatGPT is counted by the week and the others by the month, Meta AI and Copilot sit inside apps people already use, and one
                  person can use several, so the lines are not added together. Perplexity reports questions, not people: 780 million in
                  May 2025. Claude and Grok have not published user counts over time. Inside Google itself, AI Overviews reached over
                  2 billion people a month by July 2025.
                </span>
              </div>
            </article>
            <article className="lp-why-panel">
              <h3>Visits in a year: AI chatbots against search engines</h3>
              <p className="sub">Change from the year before, top 10 of each, April 2024 to March 2025</p>
              <Bar label="AI chatbots" value="+81%" pct={100} tone="teal" small="30.5 to 55.2 billion visits" />
              <Bar label="Search engines" value="-0.5%" pct={1.5} tone="pink" small="1,872 to 1,863 billion visits" />
              <div className="foot"><Study k="onelittleweb" tone="teal" /><span>Search engines are still about 34 times bigger. The growth is all on one side.</span></div>
            </article>
            <div className="lp-why-pair">
              <article className="lp-why-panel">
                <h3>Google searches that send nobody to a website</h3>
                <p className="sub">Share of US searches that end without a click to the open web</p>
                <Bar label="2019" value="49%" pct={49} tone="teal" />
                <Bar label="2024" value="58.5%" pct={58.5} tone="sun" />
                <Bar label="2026" value="68%" pct={68} tone="pink" />
                <div className="foot">
                  <Study k="zeroClick2024" /> <Study k="zeroClick2026" />
                  <span>Each year was measured on a different panel, so read it as a direction, not an exact rise.</span>
                </div>
              </article>
              <article className="lp-why-panel">
                <h3>Clicks on the top Google result</h3>
                <p className="sub">Share of searchers who click it, December 2023 and December 2025</p>
                <Bar label="Searches with an AI answer" small="2023" value="7.3%" pct={96} tone="teal" />
                <Bar label="Searches with an AI answer" small="2025" value="1.6%" pct={21} tone="pink" />
                <Bar label="Searches without one" small="2023" value="7.6%" pct={100} tone="teal" />
                <Bar label="Searches without one" small="2025" value="3.9%" pct={51} tone="pink" />
                <div className="foot">
                  <Study k="ahrefsClicks" /> <Study k="chartbeat" />
                  <span>News sites got 33% fewer visits from Google search in the year to November 2025.</span>
                </div>
              </article>
            </div>
            <p className="lp-why-note">
              People are not searching Google less: Google says its searches are still growing, and its share of search has stayed near 90%.
              What is falling is the click from a search to a website. More of the answer is read on the results page, or in an AI tool,
              without a visit. <Study k="googleQueries" />
            </p>
            <div className="lp-why-pair">
              <article className="lp-why-panel">
                <h3>Google searches that end in a click</h3>
                <p className="sub">Share of visits where the person clicked a result</p>
                <Bar label="No AI summary" value="15%" pct={100} tone="teal" />
                <Bar label="With an AI summary" value="8%" pct={53} tone="pink" />
                <div className="foot"><Study k="pew" /><span>900 US adults, 68,879 searches</span></div>
              </article>
              <article className="lp-why-panel feature">
                <div className="huge">12%</div>
                <h3>of Google&apos;s search volume, on ChatGPT alone</h3>
                <p className="sub">Google is still far bigger. The direction is one way.</p>
                <div className="foot"><Study k="ahrefsShare" tone="sun" /><span className="light">Estimates run from 4% to 18%.</span></div>
              </article>
            </div>
          </div>
        </section>

        {/* ---------- 1. the shift ---------- */}
        <section className="lp-section bone" id="shift">
          <div className="lp-inner">
            <header className="lp-section-head">
              <span className="lp-eyebrow">The shift</span>
              <h2 className="lp-h2">
                Customers moved. <span className="accent">Most owners have not.</span>
              </h2>
            </header>
            <div className="lp-why-tiles">
              <article className="lp-why-tile teal">
                <div className="lp-why-cols" aria-hidden="true">
                  <span style={{ height: "13%" }}><b>6%</b></span>
                  <span style={{ height: "100%" }}><b>45%</b></span>
                </div>
                <h3>45% ask AI for a local business</h3>
                <p>Up from 6% a year earlier.</p>
                <Study k="brightlocal" tone="teal" />
              </article>
              <article className="lp-why-tile orange">
                <Donut pct={47} label="47%" tone="orange" />
                <h3>47% did it in the past month</h3>
                <p>58% then visited the business&apos;s website.</p>
                <Study k="yext" tone="orange" />
              </article>
              <article className="lp-why-tile plum">
                <Donut pct={13} label="13%" tone="plum" />
                <h3>Only 13% of owners are acting</h3>
                <p>The gap is the opening.</p>
                <Study k="bluehost" tone="plum" />
              </article>
            </div>
          </div>
        </section>

        {/* ---------- 2. intent ---------- */}
        <section className="lp-section" id="intent">
          <div className="lp-inner">
            <header className="lp-section-head">
              <span className="lp-eyebrow">High intent</span>
              <h2 className="lp-h2">
                A mention reaches people <span className="accent">already choosing.</span>
              </h2>
            </header>
            <div className="lp-why-pair">
              <article className="lp-why-panel">
                <h3>Extra site visits after an AI mention</h3>
                <p className="sub">Percentage points, within a week</p>
                <Bar label="Gemini" value="+3.21" pct={100} tone="plum" />
                <Bar label="Google AI Overviews" value="+2.96" pct={92} tone="orange" />
                <Bar label="ChatGPT" value="+2.07" pct={64} tone="teal" />
                <div className="foot"><Study k="profound" /><span>2 million AI conversations</span></div>
              </article>
              <article className="lp-why-panel feature">
                <div className="huge">2.5x</div>
                <h3>more likely to be visited within 7 days</h3>
                <p className="sub">Brands that ChatGPT recommended, against those it did not.</p>
                <div className="foot"><Study k="similarweb" tone="sun" /></div>
              </article>
            </div>
            <p className="lp-proof-note">Both cover large national brands and measure visits, not sales.</p>
          </div>
        </section>

        {/* ---------- 3. cases ---------- */}
        <section className="lp-section bone" id="cases">
          <div className="lp-inner">
            <header className="lp-section-head">
              <span className="lp-eyebrow">Success stories</span>
              <h2 className="lp-h2">
                AI is already a <span className="accent">source of customers.</span>
              </h2>
            </header>
            <div className="lp-why-cases">
              {CASES.map((c) => (
                <article className={`lp-why-case ${c.tone}`} key={c.who}>
                  <span className="who">{c.who}</span>
                  <div className="n">{c.n}</div>
                  <p>{c.what}</p>
                  <div className="foot">
                    <Study k={c.study} tone={c.tone} />
                    {c.note && <span>{c.note}</span>}
                  </div>
                </article>
              ))}
            </div>
            <p className="lp-proof-note">
              Each figure is the company&apos;s own. Most are software companies; no named local-business case exists
              yet, from anyone. Results showed in leads over 90 days to six months.
            </p>
          </div>
        </section>

        {/* ---------- 4. the cost of being wrong ---------- */}
        <section className="lp-section ink" id="wrong">
          <div className="lp-inner">
            <header className="lp-section-head">
              <span className="lp-eyebrow">The other half</span>
              <h2 className="lp-h2">
                AI is talking about you <span className="accent">either way.</span>
              </h2>
            </header>
            <div className="lp-why-trio">
              <div>
                <Donut pct={68} label="68%" tone="pink" />
                <h3>accurate on contact details</h3>
                <p>ChatGPT, Perplexity and similar tools. One in three wrong.</p>
                <Study k="soci" tone="pink" />
              </div>
              <div>
                <Donut pct={64} label="64%" tone="orange" />
                <h3>of retailers had a false fact</h3>
                <p>Smaller businesses were hit harder.</p>
                <Study k="searchable" tone="orange" />
              </div>
              <div>
                <Donut pct={90} label="90%+" tone="teal" />
                <h3>accuracy after fixing sources</h3>
                <p>What MongoDB reported once wrong citations were corrected.</p>
                <Study k="mongodb" tone="teal" />
              </div>
            </div>
          </div>
        </section>

        {/* ---------- 5. the numbers ---------- */}
        <section className="lp-section bone" id="cost">
          <div className="lp-inner">
            <header className="lp-section-head">
              <span className="lp-eyebrow">The numbers</span>
              <h2 className="lp-h2">
                A low-cost way to reach <span className="accent">the top of the funnel.</span>
              </h2>
            </header>
            <div className="lp-why-pair">
              <article className="lp-why-panel">
                <h3>One lead on Google Ads</h3>
                <p className="sub">Average cost, paid again for every lead</p>
                <Bar label="Legal" value="$131.63" pct={100} tone="pink" />
                <Bar label="Home improvement" value="$90.92" pct={69} tone="orange" />
                <Bar label="Dental" value="$72.97" pct={55} tone="sun" />
                <Bar label="Restaurants" value="$30.57" pct={23} tone="plum" />
                <div className="foot"><Study k="localiq" /></div>
              </article>
              <article className="lp-why-panel">
                <h3>A month of AI visibility work</h3>
                <p className="sub">Agencies against Mirror</p>
                <Bar label="GEO agency, median" value="$6,850" pct={100} tone="pink" />
                <Bar label="GEO agency, starter" value="$2,950" pct={43} tone="orange" small="3-month minimum" />
                <Bar label="Mirror Partner" value="$399" pct={5.8} tone="teal" small="cancel anytime" />
                <Bar label="Mirror Pulse" value="$149" pct={2.2} tone="teal" small="cancel anytime" />
                <div className="foot"><Study k="fps" /><span>The publisher sells this service.</span></div>
              </article>
            </div>
            <div className="lp-statbar">
              <span className="n">$149</span>
              <p>A month of Pulse costs about what one legal lead, or two dental leads, cost on Google Ads.</p>
              <Link className="src" href="/pricing">See pricing →</Link>
            </div>
            <p className="lp-proof-note">That compares prices, not results. We do not promise a number of leads.</p>
          </div>
        </section>

        {/* ---------- 6. it can be moved ---------- */}
        <section className="lp-section" id="moved">
          <div className="lp-inner">
            <header className="lp-section-head">
              <span className="lp-eyebrow">It can be moved</span>
              <h2 className="lp-h2">
                What AI says about you <span className="accent">is not fixed.</span>
              </h2>
            </header>
            <div className="lp-why-pair">
              <article className="lp-why-panel feature teal">
                <div className="huge">Up to 40%</div>
                <h3>more of the answer, from better pages</h3>
                <p className="sub">Adding quotes, statistics and sources, in a lab test. Smaller sites gained most.</p>
                <div className="foot"><Study k="princeton" tone="sun" /></div>
              </article>
              <article className="lp-why-panel">
                <h3>Where AI reads local facts</h3>
                <p className="sub">Four places you can correct</p>
                <div className="lp-why-split" role="img" aria-label="Google Maps 32.5%, your website 23.1%, Yelp 10.5%, Facebook 7.6%, everything else 26.3%">
                  <span className="teal" style={{ width: "32.5%" }} />
                  <span className="gold" style={{ width: "23.1%" }} />
                  <span className="pink" style={{ width: "10.5%" }} />
                  <span className="plum" style={{ width: "7.6%" }} />
                  <span className="rest" style={{ width: "26.3%" }} />
                </div>
                <ul className="lp-why-key">
                  <li><i className="teal" />Google Maps <b>32.5%</b></li>
                  <li><i className="gold" />Your website <b>23.1%</b></li>
                  <li><i className="pink" />Yelp <b>10.5%</b></li>
                  <li><i className="plum" />Facebook <b>7.6%</b></li>
                </ul>
                <div className="foot"><Study k="soci" /></div>
              </article>
            </div>
          </div>
        </section>

        {/* ---------- 7. the honest part ---------- */}
        <section className="lp-section bone">
          <div className="lp-inner lp-faq">
            <header>
              <h2 className="lp-h3">What the evidence does not show</h2>
            </header>
            <div className="list">
              <details open>
                <summary>Do AI visitors convert better than search visitors?</summary>
                <p>
                  Not settled. Single sites report big gaps. A 54-site study found no real difference and a 973-site
                  study found ChatGPT converting worse than Google.
                </p>
                <p className="lp-why-links"><Study k="amsive" /> <Study k="sel" tone="plum" /></p>
              </details>
              <details>
                <summary>How big is this for a small local business today?</summary>
                <p>Often modest. It grows with how much people search for what you sell. Your free audit shows where you stand.</p>
              </details>
              <details>
                <summary>Has anyone measured sales lost to wrong AI answers?</summary>
                <p>No. What is measured is how often the facts are wrong.</p>
              </details>
              <details>
                <summary>How long does it take?</summary>
                <p>Mentions moved within weeks in the reported cases. Leads took 90 days to six months.</p>
              </details>
            </div>
          </div>
        </section>

        {/* ---------- sources ---------- */}
        <section className="lp-section" id="sources">
          <div className="lp-inner">
            <header className="lp-section-head">
              <span className="lp-eyebrow">Sources</span>
              <h2 className="lp-h3">Every study on this page</h2>
            </header>
            <ol className="lp-why-sources">
              {(Object.keys(STUDIES) as StudyKey[]).map((k) => (
                <li key={k}>
                  <a href={STUDIES[k].href} target="_blank" rel="noopener noreferrer">{STUDIES[k].full}</a>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <LandingCta eyebrow="Start free" sub="See how often AI names you, who it names instead, and what it gets wrong.">
          See your own numbers first.
        </LandingCta>
      </main>

      <LandingFooter />
    </div>
  );
}
