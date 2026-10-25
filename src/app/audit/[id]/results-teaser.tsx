import Link from "next/link";
import { ScoreDial } from "@/components/ui";
import { ENGINE_NAMES } from "@/core/coverage";
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
 * Stand-ins for the rest of the report, blurred behind the sign-up card.
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

/**
 * The finished audit's teaser, above the two columns: the score, who AI named
 * most, and one real answer, then the rest blurred behind "create your
 * account". Fed by the same queries as the dashboard's PreviewSummary, and
 * like it uses buyer questions only: a question that names the business can
 * repeat facts nobody has confirmed with them yet.
 */
export function ResultsTeaser({ leadId, ranking, checks, topCompetitor, askEmail }: {
  leadId: string;
  ranking: number | null;
  checks: TeaserCheck[];
  topCompetitor: { name: string; mentions: number } | null;
  askEmail: boolean;
}) {
  const earned = checks.filter(c => c.promptKind !== "branded");
  const named = earned.filter(c => c.mentioned).length;
  const shown = earned.find(c => !c.mentioned && (c.competitorsMentioned?.length ?? 0) > 0) ?? earned[0];

  return (
    <div className="mk-teaser">
      <div className="mk-teaser-top">
        <div className="mk-form-card mk-teaser-score">
          <span className="mk-eyebrow">Recommended by AI</span>
          <div className="mk-teaser-dial">
            <ScoreDial value={ranking} label="Score" />
            <p className="mk-body">
              AI named you in {named} of {earned.length} answers when customers asked without using your name.
              {topCompetitor && <> It named <strong>{topCompetitor.name}</strong> most.</>}
            </p>
          </div>
        </div>
        {shown && (
          <div className="mk-form-card">
            <span className="mk-eyebrow">{shown.mentioned ? "One answer" : "An answer you were left out of"}</span>
            <p className="mk-field-hint" style={{ marginTop: 14 }}>
              We asked {ENGINE_NAMES[shown.engine as keyof typeof ENGINE_NAMES] ?? shown.engine}: &ldquo;{shown.promptText}&rdquo;
            </p>
            <blockquote className="mk-teaser-quote">&ldquo;{excerpt(shown.answerText)}&rdquo;</blockquote>
          </div>
        )}
      </div>

      <div className="mk-teaser-locked">
        <div className="mk-teaser-blur" aria-hidden="true" data-blurred>
          {PLACEHOLDER.map(card => (
            <div key={card.title} className="mk-form-card">
              <span className="mk-eyebrow">{card.title}</span>
              <ul>{card.lines.map(line => <li key={line}>{line}</li>)}</ul>
            </div>
          ))}
        </div>
        <div className="mk-teaser-overlay">
          <div className="mk-form-card">
            <h2 className="mk-display mk-h3">Create your account to see the full audit</h2>
            <AccountForm leadId={leadId} askEmail={askEmail} />
            <p className="mk-field-hint" style={{ marginTop: 14 }}>
              Already have an account? <Link href="/login">Log in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
