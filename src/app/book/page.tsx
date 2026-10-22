import type { Metadata } from "next";
import "../landing.css";
import { LandingFooter, LandingNav } from "@/components/landing/chrome";
import { BookingForm } from "./booking-form";

/**
 * The audit-request form every landing-page CTA points at. Public (see
 * PUBLIC_PATHS in src/middleware.ts) and, like "/", makes no session read and
 * no database call, so it renders for a cold visitor even when DATABASE_URL is
 * unreachable. The only request input it reads is ?websiteUrl=, which the
 * home page's lookup box sends to prefill the form.
 *
 * It wears the same nav and footer as the other marketing pages, so the step
 * from the website to the form does not look like a different product.
 *
 * Copy follows the vocabulary in
 * docs/superpowers/specs/2026-10-05-general-business-algorithm-design.md
 * (section 8): "business", "customers", "team" or "people", "services".
 */

// Submitting the form sets up the prospect and runs the first step of their
// first scan in the background (after()), inside this page's time budget.
// Later steps run in /api/cron/scan-step, each with its own 300s (the Hobby
// plan's most).
export const maxDuration = 300;

export const metadata: Metadata = {
  title: "Book your audit · Mirror",
  description:
    "Thirty minutes on a call. We run your business through ChatGPT, Claude, Gemini, Grok and Perplexity first, then walk you through what they actually said.",
};

const STEPS = [
  {
    n: "01",
    head: "You send your business",
    body: "Name and website are enough for us to find you the way an engine finds you. Add what kind of business it is and where, and we ask what your customers ask.",
  },
  {
    n: "02",
    head: "We scan before we call",
    body: "Your business goes through every major AI assistant on the questions your customers actually ask. We read the answers before you do.",
  },
  {
    n: "03",
    head: "Thirty minutes, verbatim",
    body: "We walk you through what they said, what they got wrong, and what it would take to change it. No slides, no engagement required.",
  },
];

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ websiteUrl?: string | string[] }>;
}) {
  // Only ever a prefill for the website field; the action validates it like
  // anything else the visitor types. Capped so a crafted link cannot stuff the
  // form with an arbitrarily long value.
  const { websiteUrl } = await searchParams;
  const initialWebsite = typeof websiteUrl === "string" ? websiteUrl.trim().slice(0, 200) : undefined;

  return (
    <div className="mk">
      <LandingNav />

      <main style={{ flex: 1 }}>
        <section className="mk-section">
          <div className="mk-inner mk-book-grid">
            <div>
              <span className="mk-eyebrow">The free baseline audit</span>
              <h1 className="lp-h2" style={{ marginTop: 18 }}>
                See where your brand stands.
              </h1>
              <hr className="mk-rule" />
              <p className="mk-lede" style={{ fontSize: 17 }}>
                A free audit of how often AI recommends you, who it recommends instead, and what it gets wrong.
              </p>

              <ol className="mk-book-steps">
                {STEPS.map((s) => (
                  <li key={s.n}>
                    <span className="num">{s.n}</span>
                    <div>
                      <strong>{s.head}</strong>
                      <p>{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Read straight off process.env rather than through loadEnv(): this
                route is deliberately renderable with a broken environment (see
                the note above), and loadEnv() throws on any missing key. */}
            <BookingForm calendlyUrl={process.env.CALENDLY_URL} initialWebsite={initialWebsite || undefined} />
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
