import type { Metadata } from "next";
import "../landing.css";
import { ENGINES, LandingCta, LandingFooter, LandingNav } from "@/components/landing/chrome";

/**
 * A company's journey with Mirror, in the order it happens: free audit, Fact
 * Sheet, clearing false information in the first month, getting recommended
 * from then on, and a full partnership at the end. Public (see PUBLIC_PATHS in
 * src/middleware.ts) and static, like "/".
 *
 * Every stage carries plan tags (green free, gold Pulse, ink Partner) so the
 * reader can see which plan a step belongs to. The page narrows as it goes:
 * the first stages are for everyone, the last is Partner only.
 *
 * Each stage shows a real screenshot of that step in the product. The
 * dashboard design is not finished, so every screenshot is a <Shot>
 * placeholder for now; replace each with an <Image> as the screens land.
 */

export const metadata: Metadata = {
  title: "How it works · Mirror",
  description:
    "Your journey with Mirror: a free audit, your Fact Sheet, false information cleared in the first month, then a partnership to get your brand recommended first.",
};

type Plan = "free" | "pulse" | "partner";
const PLAN_LABEL: Record<Plan, string> = { free: "Free", pulse: "Pulse", partner: "Partner" };

function StageHead({ num, when, plans }: { num: string; when: string; plans: Plan[] }) {
  return (
    <div className="lp-jhead">
      <span className="num">{num}</span>
      <span className="lp-chip neutral">{when}</span>
      <span className="tags">
        {plans.map((p) => (
          <span className={`lp-tag ${p}`} key={p}>
            {PLAN_LABEL[p]}
          </span>
        ))}
      </span>
    </div>
  );
}

/** Placeholder for a product screenshot that does not exist yet. */
function Shot({ title, note }: { title: string; note: string }) {
  return (
    <div className="lp-shot" role="img" aria-label={`Screenshot to come: ${title}`}>
      <strong>{title}</strong>
      <span>{note}</span>
    </div>
  );
}

const ENGINE_LIST = `${ENGINES.slice(0, -1).join(", ")} and ${ENGINES[ENGINES.length - 1]}`;

/* The three ways false information gets cleared. Colour matches the plan tag. */
const OPTIONS = [
  {
    kind: "pulse",
    tag: "Pulse",
    head: "We show you what to fix",
    body: "A prioritized list of every wrong fact, the source behind it, and exactly what to change. Your team makes the changes.",
    cost: "Included in Pulse",
  },
  {
    kind: "once",
    tag: "One-time cleanup",
    head: "We fix it once",
    body: "Stay on Pulse and have us clear the false information for you. One service fee, no change of plan.",
    cost: "One-time fee, quoted after your audit",
  },
  {
    kind: "partner",
    tag: "Partner",
    head: "We fix it for you",
    body: "We correct the sources ourselves and keep correcting them as new errors appear.",
    cost: "Included in Partner",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mk">
      <LandingNav />

      <main style={{ flex: 1 }}>
        <div className="lp-keybar">
          <div className="lp-inner lp-legend">
            <span className="lbl">Each step shows the plan it belongs to:</span>
            <span className="lp-tag free">Free</span>
            <span className="lp-tag pulse">Pulse</span>
            <span className="lp-tag partner">Partner</span>
          </div>
        </div>

        {/* ---------- 01 audit ---------- */}
        <section className="lp-section" id="audit">
          <div className="lp-inner">
            <StageHead num="01" when="Day 1" plans={["free"]} />
            <div className="lp-results">
              <div className="copy">
                <h1 className="lp-h2">
                  Start with a <span className="accent">free audit.</span>
                </h1>
                <p className="lp-side">
                  We ask {ENGINE_LIST} the questions your customers ask, then walk you through the answers on a
                  30-minute call: who AI recommends, where you appear, and what it gets wrong.
                </p>
              </div>
              <Shot title="Your audit report" note="Screenshot of a real audit" />
            </div>
          </div>
        </section>

        {/* ---------- 02 fact sheet ---------- */}
        <section className="lp-section bone" id="fact-sheet">
          <div className="lp-inner">
            <StageHead num="02" when="Week 1" plans={["pulse", "partner"]} />
            <header className="lp-split-head">
              <div className="lp-section-head">
                <h2 className="lp-h2">
                  We build <span className="accent">your Fact Sheet.</span>
                </h2>
              </div>
              <p className="lp-side">
                On a call, we write down the true version of your business and you approve it. Every AI answer is
                checked against it from here on.
              </p>
            </header>
            <div className="lp-shots">
              <Shot title="The Fact Sheet call" note="Screenshot of the screen call" />
              <Shot title="Your Fact Sheet" note="Screenshot of a finished Fact Sheet" />
            </div>
          </div>
        </section>

        {/* ---------- 03 clear false information ---------- */}
        <section className="lp-section" id="catch">
          <div className="lp-inner">
            <StageHead num="03" when="Month 1" plans={["pulse", "partner"]} />
            <div className="lp-results">
              <div className="copy">
                <h2 className="lp-h2">
                  Clear the <span className="accent">false information.</span>
                </h2>
                <p className="lp-side">
                  The first month is about accuracy. Every wrong fact is traced to the source AI took it from. You
                  choose how it gets fixed.
                </p>
              </div>
              <Shot title="Wrong facts and their sources" note="Screenshot of the Wrong facts page" />
            </div>
            <div className="lp-options">
              {OPTIONS.map((o) => (
                <article className={`lp-option ${o.kind}`} key={o.tag}>
                  <span className={`lp-tag ${o.kind}`}>{o.tag}</span>
                  <h3>{o.head}</h3>
                  <p>{o.body}</p>
                  <span className="cost">{o.cost}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- 04 get recommended ---------- */}
        <section className="lp-section bone" id="recommended">
          <div className="lp-inner">
            <StageHead num="04" when="Month 2 on" plans={["pulse", "partner"]} />
            <div className="lp-results">
              <div className="copy">
                <h2 className="lp-h2">
                  Then get <span className="accent">recommended more often.</span>
                </h2>
                <p className="lp-side">
                  Once AI describes you correctly, the work turns to being named. Weekly scans track how often AI
                  recommends you, who it recommends instead, and which sources it relies on.
                </p>
                <p className="lp-side">
                  <strong>Every plan gets a monthly report</strong> and a dashboard with every answer, word for word.
                </p>
              </div>
              <Shot title="Your dashboard" note="Screenshot of recommendations over time" />
            </div>
            <div className="lp-shots">
              <Shot title="Your monthly report" note="Screenshot of a monthly report" />
              <Shot title="You versus competitors" note="Screenshot of the competitor view" />
            </div>
          </div>
        </section>

        {/* ---------- 05 full partnership (Partner only) ---------- */}
        <section className="lp-section ink" id="partnership">
          <div className="lp-inner">
            <StageHead num="05" when="Ongoing" plans={["partner"]} />
            <div className="lp-results">
              <div className="copy">
                <h2 className="lp-h2 big">
                  A full partnership to put <span className="accent">your brand first.</span>
                </h2>
                <p className="lp-side">
                  On Partner, we stop handing you a list and start doing the work: pushing your brand above every
                  competitor AI could name instead. Call us whenever.
                </p>
              </div>
              <Shot title="Customers from AI" note="Screenshot of the AI traffic dashboard, in development" />
            </div>
          </div>
        </section>

        <LandingCta eyebrow="Step one" sub="Get a free audit across ChatGPT, Gemini, Perplexity and more.">
          See where your brand stands.
        </LandingCta>
      </main>

      <LandingFooter />
    </div>
  );
}
