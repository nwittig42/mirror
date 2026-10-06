import Link from "next/link";
import type { Metadata } from "next";
import { MirrorLockup } from "@/components/mirror-mark";

/**
 * Public marketing page. Unauthenticated alongside /login and /book (the
 * audit-request form every CTA below points at).
 * The signed-in role router that used to live here now sits at /app.
 *
 * Copy follows section 8 of
 * docs/superpowers/specs/2026-10-05-general-business-algorithm-design.md: the
 * entity is a "business" (never practice), readers of AI answers are
 * "customers" (never patients), staff are the "team" or "people" (never
 * providers), offerings are "services" (never treatments). The fictional
 * plumber in the example card is the same demo scripts/seed.ts creates.
 *
 * Deliberately static: no session read, no database call. It renders for a
 * cold visitor with no DATABASE_URL reachable, which is what makes it safe to
 * hand to a prospect mid-call.
 */

export const metadata: Metadata = {
  title: "Mirror: See what AI tells your customers",
  description:
    "Mirror monitors what ChatGPT, Claude, Gemini, Grok, and Perplexity tell customers about your business, catches the errors, and fixes them at the source.",
};

const STATS = [
  {
    n: "72.5%",
    label:
      "of local-discovery citations in Google AI Mode go to Yelp, 62.1% in Perplexity, and 91 to 97% of them come from category prompts, not brand prompts",
    src: "Foundation / AirOps analysis of 28M+ local AI responses, Q4 2025, foundationinc.co",
  },
  {
    n: "0.664",
    label: "correlation between mentions of a business and its AI visibility, against 0.218 for backlinks",
    src: "Citation-study patterns, see our operating manual",
  },
  {
    n: "5",
    label: "answer engines scanned every week, on the prompts your customers actually type",
    src: "ChatGPT · Claude · Gemini · Grok · Perplexity",
  },
];

const ADVANTAGES = [
  {
    body: (
      <>
        <strong>Customers ask the machine first.</strong> Before they read your reviews, they ask which business in
        their city is best. You are either in that answer or you are not.
      </>
    ),
  },
  {
    body: (
      <>
        <strong>Being wrong is worse than being absent.</strong> An engine that invents a service you do not offer,
        or a license you do not hold, is a compliance problem wearing a marketing costume.
      </>
    ),
  },
  {
    body: (
      <>
        <strong>You cannot fix what you cannot see.</strong> There is no dashboard inside ChatGPT. Without monitoring,
        the first time you learn what it says is when a customer repeats it back to you.
      </>
    ),
  },
  {
    body: (
      <>
        <strong>The answer is editable.</strong> Engines lean on your own site, your directory listings, and what other
        people write about you. All three can be corrected. That is the work.
      </>
    ),
  },
];

const STEPS = [
  {
    num: "01",
    title: "We build your Fact Sheet",
    body: "Every person on your team and their verified credentials, every service under its real name, your hours and pricing, and the list of what you explicitly do not offer.",
    bullets: [
      "Credentials checked against the state licensing board",
      "Name variations captured, because customers search for the owner as often as the business",
      "The not-offered list is the bait an engine hallucinates into",
    ],
  },
  {
    num: "02",
    title: "We scan five AI assistants, every week",
    body: "A fixed battery of prompts: your city, your core services, and direct questions about your business by name, run against all five AI assistants.",
    bullets: [
      "Whether you were named, and where in the answer",
      "Which competitors were named beside you",
      "Every claim checked against the Fact Sheet, verbatim",
    ],
    reversed: true,
  },
  {
    num: "03",
    title: "We fix it at the source",
    body: "Findings become work: corrections to your own pages, directory and profile cleanup, and the structured answers engines prefer to quote.",
    bullets: [
      "Your own site and your listings supply most of the citations",
      "Mentions move visibility more than links do",
      "Every month you get the accuracy report, and what changed",
    ],
  },
];

const INCLUDED = [
  {
    title: "Weekly scans",
    body: "Five engines, a fixed prompt battery, every week. Trends you can actually read over ninety days.",
  },
  {
    title: "Hallucination detection",
    body: "Every answer checked against your Fact Sheet. Contradictions surface as findings, ranked by severity.",
  },
  {
    title: "AI Visibility Score",
    body: "One number: 70% how visible you are (named, rank, reach) and 30% how accurate AI is about you. A serious wrong fact caps it at 70.",
  },
  {
    title: "Competitor share of voice",
    body: "Who gets named when you don’t, on the prompts that matter in your city.",
  },
  {
    title: "Verbatim answers",
    body: "The actual text each engine returned, kept and dated. No summaries you have to take on faith.",
  },
  {
    title: "Monthly accuracy report",
    body: "What was wrong, what we corrected, and what moved. Printable, and written to be shown to a partner.",
  },
];

const FAQ = [
  {
    q: "How is this different from SEO?",
    a: "SEO competes for a position in a list of links. This competes to be named inside a written answer, which usually cites three or four sources and nothing else. The inputs overlap, and your own pages matter to both, but the target and the measurement are different.",
  },
  {
    q: "Can you actually change what ChatGPT says?",
    a: "Not directly, and anyone who claims otherwise is selling something. What moves is the material the engines read: your own site, your directory and profile listings, and what third parties write about you. Correct those and the answers follow, usually over weeks rather than days.",
  },
  {
    q: "What counts as a hallucination?",
    a: "Any claim in an engine's answer that contradicts your Fact Sheet: a service you do not offer, a license you do not hold, an address or price that is out of date. Because you approve the Fact Sheet, you decide what the truth is before we start measuring against it.",
  },
  {
    q: "How long before anything changes?",
    a: "The baseline scan is immediate. You will see what the engines say about you today. Corrections at the source typically take one to two scan cycles to appear in answers, and the ninety-day trend is where the question of whether it is working actually gets settled.",
  },
  {
    q: "Which businesses does this work for?",
    a: "Any business customers find by asking for a kind of service in a place: plumbers, bakeries, law firms, gyms, dentists, contractors, salons. If a customer could find you by asking an AI assistant for the best plumber, bakery or law firm in your city, this applies to you. The Fact Sheet, the prompts and the competitor list are built for your trade and your city, so the scan measures the questions your customers actually ask.",
  },
];

/* A real-shaped example of what a scan returns: a verbatim answer with the
   false clauses marked and the Fact Sheet contradictions stated underneath.
   The business is fictional (the same demo plumber scripts/seed.ts creates).
   This is an illustration of the output format, not a captured result, and
   the proof section says so in visible copy. */
function AnswerCard() {
  return (
    <figure className="mk-answer" style={{ margin: 0 }}>
      <figcaption className="mk-answer-head">
        <span className="mk-answer-engine">ChatGPT</span>
        <span className="mk-answer-meta">Prompt: “best plumber in Portland for a water heater replacement”</span>
      </figcaption>
      <div className="mk-answer-body">
        For a water heater replacement in Portland, a frequently mentioned option is{" "}
        <strong style={{ color: "#1a1a18" }}>Harbor Plumbing and Drain</strong>. They handle tank and tankless units
        and <span className="mk-false">are licensed in both Oregon and Washington</span>. They also offer{" "}
        <span className="mk-false">24/7 emergency service</span> and free estimates.
      </div>
      <div className="mk-answer-foot">
        <span className="mk-flag-dot" />
        <p className="txt" style={{ margin: 0 }}>
          <strong>2 contradictions with your Fact Sheet.</strong> The business holds an Oregon CCB license only, not a
          Washington one, and 24/7 emergency service is on the not-offered list.
        </p>
      </div>
    </figure>
  );
}

export default function LandingPage() {
  return (
    <div className="mk">
      {/* ---------- header ---------- */}
      <header className="mk-header">
        <Link href="/" aria-label="Mirror home" style={{ textDecoration: "none" }}>
          <MirrorLockup height={40} priority />
        </Link>
        <nav className="mk-nav">
          <a href="#how">How it works</a>
          <a href="#proof">What a scan returns</a>
          <a href="#included">What’s included</a>
          <a href="#faq">FAQ</a>
          <Link href="/login">Log in</Link>
        </nav>
        <Link href="/book" className="mk-btn mk-btn-sm">
          Book your audit
        </Link>
      </header>

      <main style={{ flex: 1 }}>
        {/* ---------- hero ---------- */}
        <section className="mk-hero">
          <video
            className="mk-hero-video"
            src="/hero-loop.mp4"
            poster="/hero-loop.jpg"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
            tabIndex={-1}
          />
          <div className="mk-inner mk-hero-grid">
            <div>
              <span className="mk-eyebrow">AI visibility for small businesses</span>
              <h1 className="mk-display mk-h1" style={{ marginTop: 18 }}>
                Your customers ask
                <br />
                AI first.
              </h1>
              <p className="mk-lede">
                Make sure it says the right things about your business. Every week, Mirror asks ChatGPT, Claude,
                Gemini, Grok, and Perplexity the questions your customers are already asking, then shows you exactly
                what they answered, what they got wrong, and what it takes to change it.
              </p>
              <div className="btns">
                <Link href="/book" className="mk-btn">
                  See what AI says about you
                </Link>
                <a href="#how" className="mk-btn-sec">
                  How it works
                </a>
              </div>
              <p className="trust">
                <span>30 minutes, on a call, on your real business</span>
                <span aria-hidden="true" style={{ color: "#a8763e" }}>
                  ·
                </span>
                <span>No engagement required to see it</span>
              </p>
            </div>
            <AnswerCard />
          </div>
        </section>

        {/* ---------- engine strip ---------- */}
        <section className="mk-engines">
          <div className="mk-inner mk-engine-row">
            <span className="lbl">Monitored weekly</span>
            <span className="eng">ChatGPT</span>
            <span className="eng">Claude</span>
            <span className="eng">Gemini</span>
            <span className="eng">Grok</span>
            <span className="eng">Perplexity</span>
          </div>
        </section>

        {/* ---------- stats ---------- */}
        <section className="mk-section tight">
          <div className="mk-inner mk-stats">
            {STATS.map((s) => (
              <div className="mk-stat" key={s.n}>
                <div className="n">{s.n}</div>
                <div className="label">{s.label}</div>
                <div className="src">{s.src}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- why this matters ---------- */}
        <section className="mk-section band-paper">
          <div className="mk-inner mk-split">
            <div>
              <span className="mk-eyebrow">The shift</span>
              <h2 className="mk-display mk-h2" style={{ marginTop: 14 }}>
                And nobody is checking the answer.
              </h2>
              <hr className="mk-rule" />
              <p className="mk-lede" style={{ fontSize: 17 }}>
                They will not see your homepage first. They will see a paragraph written about you by a system you have
                never audited, drawn from sources you have never checked. Mirror is how you read that paragraph, and
                how you correct it.
              </p>
              <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
                <Link href="/book" className="mk-btn">
                  See what AI says about you
                </Link>
                <a href="#faq" className="mk-btn-sec">
                  Read the FAQ
                </a>
              </div>
            </div>
            <ul className="mk-checklist">
              {ADVANTAGES.map((a, i) => (
                <li key={i}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M4 12.5l5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p>{a.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- how it works ---------- */}
        <section className="mk-section band-bone" id="how">
          <div className="mk-inner">
            <span className="mk-eyebrow">How it works</span>
            <h2 className="mk-display mk-h2" style={{ marginTop: 14, maxWidth: 620 }}>
              Establish the truth. Measure the answer. Fix the source.
            </h2>
            <hr className="mk-rule" />
            <div className="mk-steps">
              {STEPS.map((s) => (
                <div className={s.reversed ? "mk-step reversed" : "mk-step"} key={s.num}>
                  <div className="copy">
                    <span className="mk-step-num">{s.num}</span>
                    <h3 className="mk-display mk-h3">{s.title}</h3>
                    <p className="mk-body" style={{ fontSize: 15.5 }}>
                      {s.body}
                    </p>
                    <ul className="mk-bullets">
                      {s.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    {s.num === "01" && (
                      <div className="mk-panel">
                        <div className="mk-panel-label">Fact Sheet · Harbor Plumbing and Drain</div>
                        {/* The counts are what scripts/seed.ts creates for this business. */}
                        {[
                          ["People", "2 verified"],
                          ["Services", "6 listed"],
                          ["Not offered", "2 listed"],
                          ["Name variations", "2 tracked"],
                        ].map(([k, v]) => (
                          <div className="mk-bar" key={k}>
                            <span style={{ flex: 1 }}>{k}</span>
                            <span style={{ color: "#1a1a18" }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {s.num === "02" && (
                      <div className="mk-panel">
                        <div className="mk-panel-label">Citation rate by engine</div>
                        {/* Illustrative figures, one row per engine the strip above
                            names, so the panel does not show four engines under a
                            promise of five. */}
                        {([
                          ["ChatGPT", 72],
                          ["Perplexity", 58],
                          ["Gemini", 41],
                          ["Grok", 36],
                          ["Claude", 30],
                        ] as const).map(([k, v]) => (
                          <div className="mk-bar" key={k}>
                            <span style={{ width: 84 }}>{k}</span>
                            <span className="track">
                              <span className="fill" style={{ width: `${v}%` }} />
                            </span>
                            <span className="pct">{v}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {s.num === "03" && (
                      <div className="mk-panel">
                        <div className="mk-panel-label">AI Visibility Score</div>
                        <div className="mk-score">
                          <span className="val">68</span>
                          <span className="of">/ 100 · 70% visibility, 30% fact accuracy</span>
                        </div>
                        {/* The four parts and their points match the score page of the
                            audit report (build-report.ts): visibility's 50/20/15 split
                            scaled into its 70 points, plus 30 for fact accuracy. */}
                        <div style={{ marginTop: 20 }}>
                          {([
                            ["How often you're named", 41],
                            ["How high you rank", 17],
                            ["How many AI tools name you", 12],
                            ["How accurate AI is about you", 30],
                          ] as const).map(([k, v]) => (
                            <div className="mk-bar" key={k}>
                              <span style={{ flex: 1 }}>{k}</span>
                              <span className="pct">{v}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- proof: what a scan actually returns ---------- */}
        <section className="mk-section band-paper" id="proof">
          <div className="mk-inner mk-split" style={{ alignItems: "center" }}>
            <div>
              <span className="mk-eyebrow">What a scan returns</span>
              <h2 className="mk-display mk-h2" style={{ marginTop: 14 }}>
                Accuracy is the product.
              </h2>
              <hr className="mk-rule" />
              <p className="mk-lede" style={{ fontSize: 17 }}>
                Ranking well while being described falsely is not a win. A business with an open inaccuracy cannot
                score above 70 in Mirror, however often it gets cited, because a customer who arrives expecting a
                service you do not offer is a worse outcome than one who never heard of you.
              </p>
              <p className="mk-body">
                Every answer is kept verbatim and dated, so you can see the exact sentence, the engine that wrote it,
                and the day it changed.
              </p>
            </div>
            <div>
              <AnswerCard />
              <p className="mk-body" style={{ fontSize: 12.5, marginTop: 14 }}>
                Illustrative example on a fictional business. Your audit runs against your real business, on the
                prompts your customers type about your city.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- included ---------- */}
        <section className="mk-section" id="included">
          <div className="mk-inner">
            <span className="mk-eyebrow">What’s included</span>
            <h2 className="mk-display mk-h2" style={{ marginTop: 14, maxWidth: 560 }}>
              Monitoring you can read, and work that follows from it.
            </h2>
            <hr className="mk-rule" />
            <div className="mk-grid">
              {INCLUDED.map((f) => (
                <div className="mk-card" key={f.title}>
                  <h4>{f.title}</h4>
                  <p>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="mk-section band-bone" id="faq">
          <div className="mk-inner narrow">
            <span className="mk-eyebrow">Questions</span>
            <h2 className="mk-display mk-h2" style={{ marginTop: 14 }}>
              What business owners ask first.
            </h2>
            <div className="mk-faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p className="ans">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- closing CTA ---------- */}
        <section className="mk-section band-ink" id="audit">
          <div className="mk-inner narrow" style={{ textAlign: "center" }}>
            <h2 className="mk-display mk-h2">Find out what they’re saying about you.</h2>
            <p className="mk-lede" style={{ margin: "20px auto 0", textAlign: "center" }}>
              We run your business through all five AI assistants before we speak, then take thirty minutes to walk you
              through the verbatim answers, the contradictions, and your baseline score. No engagement required to see
              it.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 34, justifyContent: "center", flexWrap: "wrap" }}>
              <Link className="mk-btn" href="/book">
                See what AI says about you
              </Link>
              <a className="mk-btn-sec" href="#how">
                See how it works
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ---------- footer ---------- */}
      <footer className="mk-footer">
        <div className="mk-footer-grid">
          <div>
            <MirrorLockup height={38} tone="ivory" tagline />
          </div>
          <div className="col">
            <span className="head">Product</span>
            <a href="#how">How it works</a>
            <a href="#proof">What a scan returns</a>
            <a href="#included">What’s included</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="col">
            <span className="head">Your business</span>
            <Link href="/login">Client log in</Link>
            <Link href="/book">Book your audit call</Link>
          </div>
        </div>
        <div className="mk-footer-legal">
          © 2026 Mirror. Not affiliated with OpenAI, Anthropic, Google, xAI, or Perplexity. Engine names are used only
          to identify the systems monitored.
        </div>
      </footer>
    </div>
  );
}
