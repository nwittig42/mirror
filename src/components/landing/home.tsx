import "@/app/landing.css";
import { ChatWindow, Dot, ENGINES, LandingCta, LandingFooter, LandingNav } from "./chrome";

/**
 * The home page: one promise, one example, one way in. Everything longer
 * lives on /how-it-works and /pricing.
 *
 * Deliberately static: no session read, no database call. It renders for a
 * cold visitor with no DATABASE_URL reachable, which is what makes it safe to
 * hand to a prospect mid-call.
 *
 * The example answer is an illustration on the fictional demo plumber
 * scripts/seed.ts creates, not a captured result.
 */

/* Problem-side evidence only. No independently checkable local-business
   success story exists yet (see reports/GEO pricing and case studies.md), so
   the home page states the size of the problem and names its sources. */
const PROOF = [
  {
    n: "45%",
    hook: "Customers ask AI first",
    body: "of US adults have used an AI tool to find a local business, up from 6% a year earlier.",
    src: "BrightLocal consumer survey, 2026",
  },
  {
    n: "68%",
    hook: "AI gets the facts wrong",
    body: "ChatGPT, Perplexity and similar assistants were only about 68% accurate on business contact details.",
    src: "SOCi Local Visibility Index, 2026, 350,000+ locations",
  },
  {
    n: "64%",
    hook: "Most brands are affected",
    body: "of businesses in one study had at least one false fact returned by an AI assistant. Smaller ones were hit harder.",
    src: "Searchable study of UK high street retailers, 2026",
  },
];

function Note({ kind, side, children }: { kind: "gold" | "flag"; side: "left" | "right"; children: string }) {
  return (
    <span className={`lp-note ${side} ${kind}`}>
      <Dot kind={kind} size={9} />
      <span className="rule" />
      <span className="txt">{children}</span>
    </span>
  );
}

export function LandingHome() {
  return (
    <div className="mk">
      <LandingNav />

      <main style={{ flex: 1 }}>
        <section className="lp-hero has-video">
          <video
            className="lp-hero-video"
            src="/hero-loop.mp4"
            poster="/hero-loop.jpg"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
            tabIndex={-1}
          />
          <div className="lp-inner">
            <h1 className="lp-h1">
              Get recommended by AI.
              <span className="soft">Fix what it gets wrong.</span>
            </h1>
            <p className="lp-pitch">
              Mirror tracks how often ChatGPT, Gemini, Perplexity and other AI assistants recommend your brand over
              competitors, flags every wrong fact, and shows you how to improve both.
            </p>
            <form className="lp-lookup" action="/book" method="get">
              <input
                type="text"
                name="websiteUrl"
                placeholder="yourwebsite.com"
                aria-label="Your website"
                autoComplete="url"
              />
              <button type="submit" className="lp-btn lp-btn-primary">
                Get a free audit
              </button>
            </form>
            <p className="lp-reassure">
              <span>✓ Free audit</span>
              <span>✓ No credit card required</span>
            </p>

            <div className="lp-stage">
              <div className="lp-chat-wrap">
                <ChatWindow question="Who’s the best plumber in Portland for a water heater replacement?">
                  <div className="lp-chat-a">
                    <p>Top options for water heater replacement in Portland:</p>
                    <ol>
                      <li>
                        <span className="n">1.</span>
                        <span>
                          <strong>Rose City Rooter</strong>: same-day installs.
                        </span>
                        <span className="lp-notes left">
                          <Note kind="gold" side="left">
                            Named first
                          </Note>
                        </span>
                      </li>
                      <li>
                        <span className="n">2.</span>
                        <span>
                          <strong>Bridgetown Drain Pros</strong>: strong reviews.
                        </span>
                      </li>
                      <li>
                        <span className="n">3.</span>
                        <span>
                          <strong>Willamette Pipeworks</strong>: well known locally.
                        </span>
                      </li>
                      <li className="flagged">
                        <span className="n">4.</span>
                        <span>
                          <strong>Harbor Plumbing and Drain</strong>: offers{" "}
                          <span className="lp-wrong">24/7 emergency service</span> and is{" "}
                          <span className="lp-wrong">licensed in Oregon and Washington</span>.
                        </span>
                        <span className="lp-notes right">
                          <Note kind="gold" side="right">
                            Named 4th. Wrong hours.
                          </Note>
                          <Note kind="flag" side="right">
                            Wrong license claim
                          </Note>
                        </span>
                      </li>
                    </ol>
                  </div>
                </ChatWindow>
                <div className="lp-verdict">
                  <span className="word">Mirror</span>
                  <span className="msg">Named last of 4. 2 wrong facts flagged.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-engines">
          <div className="lp-inner">
            <span className="lbl">Tracks every major AI assistant</span>
            {ENGINES.map((e) => (
              <span className="eng" key={e}>
                {e}
              </span>
            ))}
          </div>
        </section>

        <section className="lp-stats">
          <div className="lp-inner">
            {PROOF.map((p) => (
              <div className="lp-stat" key={p.n}>
                <div className="n">{p.n}</div>
                <div className="hook">{p.hook}</div>
                <p className="body">{p.body}</p>
                <p className="src">{p.src}</p>
              </div>
            ))}
          </div>
        </section>

        <LandingCta
          eyebrow="Get started"
          sub="Get a free audit across ChatGPT, Gemini, Perplexity and more."
        >
          See where your brand stands.
        </LandingCta>
      </main>

      <LandingFooter />
    </div>
  );
}
