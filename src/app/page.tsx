import Link from "next/link";
import type { Metadata } from "next";
import { MirrorLockup } from "@/components/mirror-mark";

/**
 * Public marketing page. Unauthenticated alongside /login and /book (the
 * audit-request form every CTA below points at).
 * The signed-in role router that used to live here now sits at /app.
 *
 * Copy follows the ICP vocabulary locked in docs/plans: the entity is a
 * "practice" (never brand/business), readers of AI answers are "patients"
 * (never users/customers), staff are "providers", offerings are "treatments".
 *
 * Deliberately static: no session read, no database call. It renders for a
 * cold visitor with no DATABASE_URL reachable, which is what makes it safe to
 * hand to a prospect mid-call.
 */

export const metadata: Metadata = {
  title: "Mirror: See what AI tells your patients",
  description:
    "Mirror monitors what ChatGPT, Claude, Gemini, and Perplexity tell patients about your practice, catches the errors, and fixes them at the source.",
};

const STATS = [
  {
    n: "80%",
    label: "of AI citations for aesthetic medicines already belong to just two pharma brands",
    src: "5W Index via PRNewswire, 2026",
  },
  {
    n: "0.664",
    label: "correlation between mentions of a practice and its AI visibility, against 0.218 for backlinks",
    src: "Citation-study patterns, see our operating manual",
  },
  {
    n: "4",
    label: "answer engines scanned every week, on the prompts your patients actually type",
    src: "ChatGPT · Claude · Gemini · Perplexity",
  },
];

const ADVANTAGES = [
  {
    body: (
      <>
        <strong>Patients ask the machine first.</strong> Before they read your reviews, they ask which practice near
        them is best. You are either in that answer or you are not.
      </>
    ),
  },
  {
    body: (
      <>
        <strong>Being wrong is worse than being absent.</strong> An engine that invents a treatment you do not offer,
        or a credential you do not hold, is a compliance problem wearing a marketing costume.
      </>
    ),
  },
  {
    body: (
      <>
        <strong>You cannot fix what you cannot see.</strong> There is no dashboard inside ChatGPT. Without monitoring,
        the first time you learn what it says is when a patient repeats it back to you.
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
    body: "Every provider and verified credential, every treatment under its real brand name, your hours and pricing, and the list of what you explicitly do not offer.",
    bullets: [
      "Credentials checked against the state medical and nursing boards",
      "Name variations captured, because patients search for the provider as often as the practice",
      "The not-offered list is the bait an engine hallucinates into",
    ],
  },
  {
    num: "02",
    title: "We scan four engines, every week",
    body: "A fixed battery of prompts: your neighborhood, your hero treatments, and direct questions about your practice by name, run against all four answer engines.",
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
      "Your site is the top citation source in the medical vertical",
      "Mentions move visibility more than links do",
      "Every month you get the accuracy report, and what changed",
    ],
  },
];

const INCLUDED = [
  {
    title: "Weekly scans",
    body: "Four engines, a fixed prompt battery, every week. Trends you can actually read over ninety days.",
  },
  {
    title: "Hallucination detection",
    body: "Every answer checked against your Fact Sheet. Contradictions surface as findings, ranked by severity.",
  },
  {
    title: "AI Visibility Score",
    body: "One number across citation rate, position, and breadth, with accuracy as a hard ceiling on it.",
  },
  {
    title: "Competitor share of voice",
    body: "Who gets named when you don’t, on the prompts that matter in your neighborhood.",
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
    a: "Any claim in an engine's answer that contradicts your Fact Sheet: a treatment you do not offer, a credential you do not hold, an address or price that is out of date. Because you approve the Fact Sheet, you decide what the truth is before we start measuring against it.",
  },
  {
    q: "How long before anything changes?",
    a: "The baseline scan is immediate. You will see what the engines say about you today. Corrections at the source typically take one to two scan cycles to appear in answers, and the ninety-day trend is where the question of whether it is working actually gets settled.",
  },
  {
    q: "Do you work with practices outside Los Angeles?",
    a: "We are concentrated in LA right now because neighborhood-level prompts are where the competition is sharpest and where we can do the source-side work properly. Ask, and we will tell you honestly whether we can serve your market well.",
  },
];

/* A real-shaped example of what a scan returns: a verbatim answer with the
   false clause marked and the Fact Sheet contradiction stated underneath.
   The practice is fictional. This is an illustration of the output format,
   not a captured result, and the proof section says so in visible copy. */
function AnswerCard() {
  return (
    <figure className="mk-answer" style={{ margin: 0 }}>
      <figcaption className="mk-answer-head">
        <span className="mk-answer-engine">ChatGPT</span>
        <span className="mk-answer-meta">Prompt: “best med spa in Santa Monica for lip filler”</span>
      </figcaption>
      <div className="mk-answer-body">
        For lip filler in Santa Monica, a frequently mentioned option is{" "}
        <strong style={{ color: "#1a1a18" }}>Glow MedSpa</strong>. They offer a broad range of injectables and{" "}
        <span className="mk-false">are supervised by a board-certified plastic surgeon</span>. They also provide{" "}
        <span className="mk-false">CO₂ laser resurfacing</span> and walk-in appointments.
      </div>
      <div className="mk-answer-foot">
        <span className="mk-flag-dot" />
        <p className="txt" style={{ margin: 0 }}>
          <strong>2 contradictions with your Fact Sheet.</strong> The practice is supervised by a board-certified
          dermatologist, not a plastic surgeon, and CO₂ resurfacing is on the not-offered list.
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
              <span className="mk-eyebrow">AI visibility for aesthetic practices</span>
              <h1 className="mk-display mk-h1" style={{ marginTop: 18 }}>
                Your patients ask
                <br />
                AI first.
              </h1>
              <p className="mk-lede">
                Make sure it says the right things about your practice. Every week, Mirror asks ChatGPT, Claude,
                Gemini, and Perplexity the questions your patients are already asking, then shows you exactly what
                they answered, what they got wrong, and what it takes to change it.
              </p>
              <div className="btns">
                <Link href="/book" className="mk-btn">
                  See your practice’s answers
                </Link>
                <a href="#how" className="mk-btn-sec">
                  How it works
                </a>
              </div>
              <p className="trust">
                <span>30 minutes, on a call, on your real practice</span>
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
                  See your practice’s answers
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
                        <div className="mk-panel-label">Fact Sheet · Glow MedSpa</div>
                        {[
                          ["Providers", "3 verified"],
                          ["Treatments", "24 listed"],
                          ["Not offered", "9 listed"],
                          ["Name variations", "6 tracked"],
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
                        {([
                          ["ChatGPT", 72],
                          ["Perplexity", 58],
                          ["Gemini", 41],
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
                          <span className="of">/ 100 · capped by 1 open inaccuracy</span>
                        </div>
                        <div style={{ marginTop: 20 }}>
                          {([
                            ["Citation rate", 50],
                            ["Position", 20],
                            ["Breadth", 15],
                            ["Accuracy", 15],
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
                Ranking well while being described falsely is not a win. A practice with an open inaccuracy cannot score
                above 70 in Mirror, however often it gets cited, because a patient who arrives expecting a treatment
                you do not offer is a worse outcome than one who never heard of you.
              </p>
              <p className="mk-body">
                Every answer is kept verbatim and dated, so you can see the exact sentence, the engine that wrote it,
                and the day it changed.
              </p>
            </div>
            <div>
              <AnswerCard />
              <p className="mk-body" style={{ fontSize: 12.5, marginTop: 14 }}>
                Illustrative example on a fictional practice. Your audit runs against your real practice, on your real
                neighborhood prompts.
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
              What practice owners ask first.
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
              We run your practice through all four engines before we speak, then take thirty minutes to walk you
              through the verbatim answers, the contradictions, and your baseline score. No engagement required to see
              it.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 34, justifyContent: "center", flexWrap: "wrap" }}>
              <Link className="mk-btn" href="/book">
                See your practice’s answers
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
            <span className="head">Practice</span>
            <Link href="/login">Client log in</Link>
            <Link href="/book">Book your audit call</Link>
          </div>
        </div>
        <div className="mk-footer-legal">
          © 2026 Mirror. Not affiliated with OpenAI, Anthropic, Google, or Perplexity. Engine names are used only to
          identify the systems monitored.
        </div>
      </footer>
    </div>
  );
}
