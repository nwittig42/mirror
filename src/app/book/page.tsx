import Link from "next/link";
import type { Metadata } from "next";
import { MirrorLockup } from "@/components/mirror-mark";
import { BookingForm } from "./booking-form";

/**
 * The audit-request form every landing-page CTA points at. Public (see
 * PUBLIC_PATHS in src/middleware.ts) and, like "/", deliberately static: no
 * session read and no database call, so it renders for a cold visitor even
 * when DATABASE_URL is unreachable.
 *
 * The header here is intentionally slimmer than the landing page's. That one
 * navigates by in-page anchors (#how, #proof), which point at nothing from
 * this route, and a visitor who has already clicked the CTA should not be
 * handed five ways to leave the form.
 *
 * Copy follows the same ICP vocabulary as "/": "practice" (never
 * brand/business), "patients" (never users/customers), "providers",
 * "treatments".
 */

export const metadata: Metadata = {
  title: "Book your audit · Mirror",
  description:
    "Thirty minutes on a call. We run your practice through ChatGPT, Claude, Gemini, and Perplexity first, then walk you through what they actually said.",
};

const STEPS = [
  {
    n: "01",
    head: "You send your practice",
    body: "Name and website. That is enough for us to find you the way an engine finds you.",
  },
  {
    n: "02",
    head: "We scan before we call",
    body: "Your practice goes through all four engines on the questions your patients actually ask. We read the answers before you do.",
  },
  {
    n: "03",
    head: "Thirty minutes, verbatim",
    body: "We walk you through what they said, what they got wrong, and what it would take to change it. No slides, no engagement required.",
  },
];

export default function BookPage() {
  return (
    <div className="mk">
      <header className="mk-header">
        <Link href="/" aria-label="Mirror home" style={{ textDecoration: "none" }}>
          <MirrorLockup height={40} priority />
        </Link>
        <nav className="mk-nav">
          <Link href="/">Back to site</Link>
          <Link href="/login">Log in</Link>
        </nav>
      </header>

      <main style={{ flex: 1 }}>
        <section className="mk-section">
          <div className="mk-inner mk-book-grid">
            <div>
              <span className="mk-eyebrow">The free baseline audit</span>
              <h1 className="mk-display mk-h1" style={{ marginTop: 18 }}>
                See what AI tells
                <br />
                your patients.
              </h1>
              <hr className="mk-rule" />
              <p className="mk-lede" style={{ fontSize: 17 }}>
                Every practice we scan has findings. The question is only whether you have read them yet.
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
            <BookingForm calendlyUrl={process.env.CALENDLY_URL} />
          </div>
        </section>
      </main>

      <footer className="mk-footer">
        <div className="mk-footer-legal" style={{ marginTop: 0, borderTop: "none", paddingTop: 0 }}>
          © 2026 Mirror. Not affiliated with OpenAI, Anthropic, Google, or Perplexity. Engine names are used only to
          identify the systems monitored.
        </div>
      </footer>
    </div>
  );
}
