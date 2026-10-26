import Link from "next/link";
import { ScoreDial } from "@/components/ui";
import { ENGINE_NAMES } from "@/core/coverage";
import { CalendlyEmbed, type CalendlyPrefill } from "@/app/book/calendly-embed";
import { AccountForm } from "./account-form";

interface TeaserCheck {
  engine: string;
  promptKind: string;
  promptText: string;
  mentioned: boolean;
  answerText: string;
  competitorsMentioned: string[] | null;
}

/**
 * Stand-ins for the rest of the report, blurred below the sign-up card.
 * Fixed text on purpose: nothing real is ever in this part of the page, so
 * nothing real can be read from its source.
 */
const PLACEHOLDER = [
  { title: "Fact check", lines: ["Prices: 3 of 5 right", "Opening hours: out of date", "Services: 1 missing"] },
  { title: "Every AI answer", lines: ["24 answers, word for word", "Where you were named", "Where you were left out"] },
  { title: "Competitors", lines: ["Named 9 times", "Named 6 times", "Named 4 times"] },
  { title: "Your fix plan", lines: ["First: update your hours", "Next: add a services page", "Then: answer common questions"] },
];

function excerpt(text: string, max = 260): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, flat.lastIndexOf(" ", max))}…`;
}

const engineName = (engine: string) => ENGINE_NAMES[engine as keyof typeof ENGINE_NAMES] ?? engine;

/** The AI tool that named them in the most buyer questions, or null when none did or two tie. */
function topEngine(earned: TeaserCheck[]): string | null {
  const counts = new Map<string, number>();
  for (const c of earned) if (c.mentioned) counts.set(c.engine, (counts.get(c.engine) ?? 0) + 1);
  const [first, second] = [...counts].sort((a, b) => b[1] - a[1]);
  return first && first[1] !== second?.[1] ? first[0] : null;
}

/**
 * The business AI named most in the same buyer questions, matched by exact
 * name and tie-broken by name as getCompetitorPressure does, so its count
 * sits on the same base as "X of Y answers".
 */
function topCompetitor(earned: TeaserCheck[]): { name: string; mentions: number } | null {
  const counts = new Map<string, number>();
  for (const c of earned) for (const name of c.competitorsMentioned ?? []) counts.set(name, (counts.get(name) ?? 0) + 1);
  const [top] = [...counts]
    .map(([name, mentions]) => ({ name, mentions }))
    .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name));
  return top ?? null;
}

/**
 * The finished audit, top to bottom: the business and the scan date, the
 * score, one real answer, the sign-up card, the rest blurred, then the call.
 * Fed by the same queries as the dashboard's PreviewSummary, and like it uses
 * buyer questions only: a question that names the business can repeat facts
 * nobody has confirmed with them yet.
 */
export function ResultsTeaser({ leadId, businessName, logo, scanDate, ranking, checks, email, calendlyUrl, prefill }: {
  leadId: string;
  businessName: string;
  logo: string | null;
  scanDate: Date;
  ranking: number | null;
  checks: TeaserCheck[];
  /** The lead's email, when they gave one: the account form asks only without it. */
  email: string | null;
  calendlyUrl?: string;
  prefill?: CalendlyPrefill;
}) {
  const earned = checks.filter(c => c.promptKind !== "branded");
  const named = earned.filter(c => c.mentioned).length;
  const shown = earned.find(c => !c.mentioned && (c.competitorsMentioned?.length ?? 0) > 0) ?? earned[0];
  const engine = topEngine(earned);
  const rival = topCompetitor(earned);

  return (
    <div className="mk-teaser">
      <header className="mk-audit-head">
        {logo && (
          // A data: address saved at setup, so next/image has nothing to optimise.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={businessName} className="mk-audit-logo" />
        )}
        <div className="mk-audit-head-text">
          <h1 className="lp-h2">{businessName}</h1>
          <p className="mk-field-hint">
            AI visibility audit · {scanDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}
          </p>
        </div>
      </header>

      <div className="mk-form-card mk-teaser-score">
        <span className="mk-eyebrow">Recommended by AI</span>
        <div className="mk-teaser-dial">
          <ScoreDial value={ranking} label="Score" />
          <div className="mk-body">
            <p>AI named you in {named} of {earned.length} answers when customers asked without using your name.</p>
            {engine && <p>{engineName(engine)} named you most.</p>}
            {rival && (
              <p>It named <strong>{rival.name}</strong> instead in {rival.mentions} of those {earned.length} answers.</p>
            )}
          </div>
        </div>
      </div>

      {shown && (
        <div className="mk-form-card">
          <span className="mk-eyebrow">{shown.mentioned ? "One answer" : "An answer you were left out of"}</span>
          <p className="mk-field-hint" style={{ marginTop: 14 }}>
            We asked {engineName(shown.engine)}: &ldquo;{shown.promptText}&rdquo;
          </p>
          <blockquote className="mk-teaser-quote">&ldquo;{excerpt(shown.answerText)}&rdquo;</blockquote>
        </div>
      )}

      <div className="mk-form-card mk-teaser-account">
        <h2 className="mk-display mk-h3">Create your free account to see your full audit</h2>
        <p className="mk-body" style={{ marginTop: 12 }}>
          Every AI answer word for word, who AI recommends instead of you, and your step-by-step recommendations.
        </p>
        <AccountForm leadId={leadId} askEmail={!email} />
        <p className="mk-field-hint" style={{ marginTop: 14 }}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>

      <div className="mk-teaser-blur" aria-hidden="true" data-blurred>
        {PLACEHOLDER.map(card => (
          <div key={card.title} className="mk-form-card">
            <span className="mk-eyebrow">{card.title}</span>
            <ul>{card.lines.map(line => <li key={line}>{line}</li>)}</ul>
          </div>
        ))}
      </div>

      <div className="mk-form-card mk-teaser-book">
        <h2 className="mk-display mk-h3">Want us to walk you through it? Book 30 minutes</h2>
        {calendlyUrl ? (
          <div className="mk-calendly-bleed">
            <CalendlyEmbed url={calendlyUrl} prefill={{ ...prefill, email: email ?? undefined }} />
          </div>
        ) : (
          <p className="mk-body" style={{ marginTop: 12 }}>
            {email
              ? "We'll reach out within one business day to set up a time."
              : "Create your account above and we'll reach out within one business day to set up a time."}
          </p>
        )}
      </div>
    </div>
  );
}
