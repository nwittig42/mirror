import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared chrome for the marketing pages ("/", "/how-it-works", "/pricing"):
 * the announcement bar, the sticky nav, the footer, and the mock assistant
 * window the home and how-it-works pages both use.
 *
 * Copy follows the vocabulary in
 * docs/superpowers/specs/2026-10-05-general-business-algorithm-design.md
 * (section 8), with one marketing-only change: headlines say "your brand",
 * the way every site in this category does, where the app says "business".
 * Readers of AI answers are "customers". No trade is named in a headline; the
 * worked example is the demo plumber scripts/seed.ts creates.
 *
 * Voice: short, declarative, verb first. Headlines of five to nine words, one
 * sentence under each, no questions or asides.
 */

export const ENGINES = ["ChatGPT", "Claude", "Gemini", "Grok", "Perplexity"];

export function LandingNav() {
  return (
    <>
      <div className="lp-announce">
        <span>First month free on every plan.</span>
        <Link href="/pricing">See pricing →</Link>
      </div>
      <header className="lp-nav">
        <div className="lp-inner">
          <Link className="lp-logo" aria-label="Mirror home" href="/">
            <span className="word">Mirror</span>
            <span className="tag">AI VISIBILITY</span>
          </Link>
          <nav className="lp-nav-links">
            <Link href="/">Home</Link>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/pricing">Pricing</Link>
          </nav>
          <div className="lp-nav-actions">
            <Link className="login" href="/login">
              Log in
            </Link>
            <Link className="lp-btn lp-btn-gold" href="/book">
              Get a free audit
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}

export function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-inner">
        <div className="top">
          <div className="brand">
            <span className="word">Mirror</span>
            <span className="tag">GET RECOMMENDED BY AI.</span>
          </div>
          <nav className="cols">
            <div className="col">
              <span className="head">Product</span>
              <Link href="/how-it-works">How it works</Link>
              <Link href="/how-it-works#catch">What we catch</Link>
              <Link href="/pricing">Pricing</Link>
            </div>
            <div className="col">
              <span className="head">Company</span>
              <Link href="/book">Get a free audit</Link>
              <Link href="/login">Client log in</Link>
            </div>
          </nav>
        </div>
        <p className="legal">
          © 2026 Mirror. Not affiliated with OpenAI, Anthropic, Google, xAI or Perplexity. Their names are used only to
          identify the tools we check.
        </p>
      </div>
    </footer>
  );
}

/** The closing band every marketing page ends on. */
export function LandingCta({ eyebrow, children, sub }: { eyebrow: string; children: ReactNode; sub: string }) {
  return (
    <section className="lp-cta">
      <div className="lp-inner">
        <span className="lp-eyebrow">{eyebrow}</span>
        <h2 className="lp-h2">{children}</h2>
        <p className="lp-sub">{sub}</p>
        <div className="btns">
          <Link className="lp-btn lp-btn-gold" href="/book">
            Get a free audit
          </Link>
          <Link className="lp-btn lp-btn-light" href="/pricing">
            See pricing
          </Link>
        </div>
        <p className="fine">No credit card required.</p>
      </div>
    </section>
  );
}

export function Dot({ kind, size }: { kind: "live" | "red" | "yellow" | "green" | "gold" | "flag"; size: number }) {
  return <Image alt="" src={`/landing/dot-${kind}.svg`} width={size} height={size} />;
}

/** A mock assistant window: title bar, the customer's question, then the answer. */
export function ChatWindow({
  question,
  children,
  foot,
}: {
  question: string;
  children: ReactNode;
  foot?: ReactNode;
}) {
  return (
    <figure className="lp-chat" style={{ margin: 0 }}>
      <div className="lp-chat-bar">
        <Dot kind="red" size={11} />
        <Dot kind="yellow" size={11} />
        <Dot kind="green" size={11} />
        <span className="title">ChatGPT</span>
      </div>
      <div className="lp-chat-body">
        <p className="lp-chat-q">{question}</p>
        {children}
      </div>
      {foot ? (
        <figcaption className="lp-chat-foot">
          <Dot kind="flag" size={9} />
          <p>{foot}</p>
        </figcaption>
      ) : null}
    </figure>
  );
}
