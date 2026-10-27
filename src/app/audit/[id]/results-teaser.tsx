import Link from "next/link";
import { ScoreDial } from "@/components/ui";
import { sitesToGetOn, type ActionPlan } from "@/core/action-plan";
import type { SourcesReport } from "@/core/citations";
import { ENGINE_NAMES } from "@/core/coverage";
import { squashedNameKey, topBuyerCompetitor } from "@/core/competitors";
import { topEngine } from "@/core/top-engine";
import { CalendlyEmbed, type CalendlyPrefill } from "@/app/book/calendly-embed";
import { AccountForm } from "./account-form";

interface TeaserCheck {
  engine: string;
  promptKind: string;
  promptText: string;
  mentioned: boolean;
  answerText: string;
  competitorsMentioned: string[];
  citations: string[];
}

// How many real titles or domains each card blurs after the one it shows.
const BLURRED = 3;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function excerpt(text: string, max = 260): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, flat.lastIndexOf(" ", max))}…`;
}

const engineName = (engine: string) => ENGINE_NAMES[engine as keyof typeof ENGINE_NAMES] ?? engine;

/**
 * The finished audit, top to bottom: the business and the scan date, the
 * score, one real answer, a taste of the action plan and of where AI read,
 * the sign-up card, then the call. Fed by the same queries as the dashboard's
 * PreviewSummary, and like it uses buyer questions only: a question that
 * names the business can repeat facts nobody has confirmed with them yet.
 *
 * The teaser cards show one real step and one real site in full, and blur the
 * next few titles or domains (aria-hidden): real, so the tease is honest, but
 * titles only, never the why or the how.
 */
export function ResultsTeaser({ leadId, businessName, logo, scanDate, ranking, checks, plan, sources, email, calendlyUrl, prefill }: {
  leadId: string;
  businessName: string;
  logo: string | null;
  scanDate: Date;
  ranking: number | null;
  checks: TeaserCheck[];
  /** The action plan for the scan, or null when it couldn't be built. */
  plan: ActionPlan | null;
  sources: SourcesReport | null;
  /** The lead's email, when they gave one: the account form asks only without it. */
  email: string | null;
  calendlyUrl?: string;
  prefill?: CalendlyPrefill;
}) {
  const earned = checks.filter(c => c.promptKind !== "branded");
  const named = earned.filter(c => c.mentioned).length;
  const shown = earned.find(c => !c.mentioned && (c.competitorsMentioned?.length ?? 0) > 0) ?? earned[0];
  const best = topEngine(earned);
  const rival = topBuyerCompetitor(earned);

  const sites = sources ? sitesToGetOn(sources, earned) : [];
  // The sources card shows the sites, so the plan card leads with the other
  // steps when there are any. Its group list still shows every group.
  const all = plan?.groups.flatMap(g => g.items) ?? [];
  const others = plan?.groups.filter(g => g.key !== "sources").flatMap(g => g.items) ?? [];
  const steps = sites.length > 0 && others.length > 0 ? others : all;
  const first = steps[0];
  // Every site AI read but the business's own.
  const read = sources?.sources.filter(s => s.kind !== "own_site").length ?? 0;
  // Sites to get on whose answers named the top competitor.
  const rivalOn = rival ? sites.filter(s => s.named.some(n => squashedNameKey(n.name) === squashedNameKey(rival.name))).length : 0;

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
            {best && <p>{engineName(best.engine)} named you most.</p>}
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

      {plan && first && (
        <div className="mk-form-card mk-teaser-plan">
          <span className="mk-eyebrow">Your action plan</span>
          <p className="mk-body" style={{ marginTop: 14 }}>
            {`We found ${plural(plan.total, "step")} for ${businessName}${plan.quickWins ? `, ${plan.quickWins} of them quick wins` : ""}.`}
          </p>
          <ul className="mk-teaser-groups">
            {plan.groups.map(g => (
              <li key={g.key}><span>{g.title}</span><span className="mk-teaser-count">{g.items.length}</span></li>
            ))}
          </ul>
          <div className="mk-teaser-step">
            <strong>{first.title}</strong>
            <p>{first.why}</p>
          </div>
          {steps.length > 1 && (
            <ul className="mk-teaser-blurred" aria-hidden="true" data-blurred>
              {steps.slice(1, 1 + BLURRED).map(i => <li key={i.key}>{i.title}</li>)}
            </ul>
          )}
        </div>
      )}

      {sources && sites.length > 0 && (
        <div className="mk-form-card mk-teaser-sources">
          <span className="mk-eyebrow">Where AI is reading</span>
          <p className="mk-body" style={{ marginTop: 14 }}>
            {`AI read ${plural(read, "website")} to answer your customers. When it recommended someone else, it was reading ${sites.length} of them.`}
            {sites.length > 8 && ` Your plan lists the ${Math.min(sites.length, 8)} that matter most.`}
            {rival && rivalOn > 0 && ` ${rival.name} was named in answers from ${rivalOn} of them.`}
          </p>
          <div className="mk-teaser-step">
            <strong>{sites[0].domain}</strong>
          </div>
          {sites.length > 1 && (
            <ul className="mk-teaser-blurred" aria-hidden="true" data-blurred>
              {sites.slice(1, 1 + BLURRED).map(s => <li key={s.domain}>{s.domain}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="mk-form-card mk-teaser-account">
        <h2 className="mk-display mk-h3">Create your free account to get your full action plan</h2>
        <p className="mk-body" style={{ marginTop: 12 }}>
          Every step, with the competitors and websites behind it, plus every AI answer word for word.
        </p>
        <AccountForm leadId={leadId} askEmail={!email} />
        <p className="mk-field-hint" style={{ marginTop: 14 }}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
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
