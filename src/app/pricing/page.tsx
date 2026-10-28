import Link from "next/link";
import type { Metadata } from "next";
import "../landing.css";
import { LandingCta, LandingFooter, LandingNav } from "@/components/landing/chrome";
import { PLAN_OFFERS } from "@/core/plan-offer";

/**
 * Plans and prices. Public (see PUBLIC_PATHS in src/middleware.ts) and static,
 * like "/".
 *
 * The reasoning behind the numbers is in
 * reports/GEO pricing and case studies.md: Pulse sits above the self-serve
 * trackers and inside what small businesses already pay for marketing tools;
 * Partner stays under the done-for-you sellers because the fixing is still
 * the customer's to do. Autopilot is not built, so it carries no price and no
 * checkout, only a waitlist.
 */

export const metadata: Metadata = {
  title: "Pricing · Mirror",
  description:
    "Mirror plans and pricing. Start with a free audit, then Pulse at $149 a month or Partner at $399 a month. First month free.",
};

const PLANS = PLAN_OFFERS;

const FAQ = [
  {
    q: "What happens after the free audit?",
    a: "You keep the results. To continue with weekly scans, choose Pulse or Partner. Your first month is free.",
  },
  {
    q: "How does the free month work?",
    a: "Your first month on Pulse or Partner is free and includes the full plan. Cancel before it ends and you pay nothing.",
  },
  {
    q: "How does Mirror help us get recommended?",
    a: "Mirror shows which brands AI recommends for your customers’ questions and which sources it relies on. Your monthly plan lists what to change to get named: your pages, your listings, and where you need to be mentioned.",
  },
  {
    q: "Is this just SEO?",
    a: "No. SEO ranks you in a list of links. Mirror tracks what AI writes in its answer, which usually names two or three brands.",
  },
  {
    q: "Can you actually change what ChatGPT says?",
    a: "Not directly. AI answers from your website, your listings and what other sites say about you. Correct those sources and the answers follow, usually within weeks.",
  },
  {
    q: "Do you fix things for us?",
    a: "On Partner, yes: we correct the sources ourselves. On Pulse we show you exactly what to change, or you can pay a one-time fee and we clear it for you.",
  },
  {
    q: "Do you access our customer data?",
    a: "No. Mirror only reads public AI answers and public web pages.",
  },
  {
    q: "Which businesses does this work for?",
    a: "Any business customers find by asking AI for a recommendation. Your Fact Sheet, tracked questions and competitors are set up for your industry and location.",
  },
];

export default function PricingPage() {
  return (
    <div className="mk">
      <LandingNav />

      <main style={{ flex: 1 }}>
        <section className="lp-section bone" id="pricing">
          <div className="lp-inner">
            <header className="lp-section-head center">
              <span className="lp-eyebrow">Pricing</span>
              <h1 className="lp-h2 big">
                Plans and pricing
              </h1>
              <p className="lp-sub">
                Start with a free audit. First month free on every plan.
              </p>
            </header>

            <div className="lp-partner-row">
              <div className="txt">
                <h3>Free audit</h3>
                <p>
                  See how often AI recommends your brand today, and what it gets wrong. No credit card required.
                </p>
              </div>
              <Link className="lp-btn lp-btn-primary" href="/book">
                Get a free audit
              </Link>
            </div>

            <div className="lp-plans">
              {PLANS.map((p) => (
                <article className={p.featured ? "lp-plan featured" : "lp-plan"} key={p.name}>
                  <div className="top">
                    <h3>{p.name}</h3>
                    {p.badge ? <span className="lp-chip gold">{p.badge}</span> : null}
                  </div>
                  <p className="price">
                    <span className="amt">{p.amt}</span>
                    <span className="per">/ month</span>
                  </p>
                  <p className="trial">First month free</p>
                  <p className="pitch">{p.pitch}</p>
                  <hr />
                  <ul>
                    {p.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <Link className={p.featured ? "lp-btn lp-btn-gold" : "lp-btn lp-btn-outline"} href="/book">
                    Start with a free audit
                  </Link>
                </article>
              ))}

              <article className="lp-plan soon">
                <div className="top">
                  <h3>Autopilot</h3>
                  <span className="lp-chip neutral">Not available yet</span>
                </div>
                <p className="price">
                  <span className="amt">Coming soon</span>
                </p>
                <p className="pitch">The Partner work, run by agents.</p>
                <hr />
                <ul>
                  <li>Everything in Partner</li>
                  <li>Agents make the fixes for you</li>
                  <li>You approve every change</li>
                  <li>First access for current customers</li>
                </ul>
                <Link className="lp-btn lp-btn-outline" href="/book">
                  Start with a free audit
                </Link>
              </article>
            </div>

            <p className="lp-terms">
              Per location. Month to month. Two months free on annual plans.
            </p>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-inner lp-faq">
            <header>
              <h2 className="lp-h3">Frequently asked questions</h2>
            </header>
            <div className="list">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
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
