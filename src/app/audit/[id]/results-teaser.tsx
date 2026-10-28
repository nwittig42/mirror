import Link from "next/link";
import { ScoreDial } from "@/components/ui";
import { sitesToGetOn, type ActionItem, type ActionPlan } from "@/core/action-plan";
import type { SourcesReport } from "@/core/citations";
import { ENGINE_NAMES } from "@/core/coverage";
import { buyerCompetitors, squashedNameKey, topBuyerCompetitor } from "@/core/competitors";
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
// How many more step titles the plan card blurs under the one it shows.
const LOCKED = 6;

const EFFORT: Record<ActionItem["effort"], string> = { low: "Low effort", medium: "Some effort", high: "Big project" };

// A question the business is losing is titled with the question itself; said as the thing to do.
const moveTitle = (item: ActionItem) => (item.key.startsWith("question:") ? `Get named for ${item.title}` : item.title);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function excerpt(text: string, max = 260): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, flat.lastIndexOf(" ", max))}…`;
}

const engineName = (engine: string) => ENGINE_NAMES[engine as keyof typeof ENGINE_NAMES] ?? engine;

// Colours for the plan's groups, in turn: the dashboard's chart tones.
const TONES = ["teal", "orange", "plum", "sun", "pink"];

// Red under 40, amber under 70, green from 70: the ring and its label.
function gradeFor(score: number | null) {
  if (score === null || score < 40) return { key: "low", label: "Needs work", stroke: "stroke-flag" };
  if (score < 70) return { key: "mid", label: "Fair", stroke: "stroke-sun" };
  return { key: "high", label: "Strong", stroke: "stroke-ok" };
}

/**
 * The finished audit, in one grey panel: the business and the scan date
 * across the top; down the left, the score, each AI tool's share, one real
 * answer, a taste of the action plan and of where AI read, then the call;
 * the sign-up card pinned on the right (under the score on a phone). Fed by the same queries as the dashboard's
 * PreviewSummary, and like it uses buyer questions only: a question that
 * names the business can repeat facts nobody has confirmed with them yet.
 *
 * The teaser cards show one real step and one real site in full, and blur the
 * next few titles or domains (aria-hidden): real, so the tease is honest, but
 * titles only, never the why or the how.
 */
export function ResultsTeaser({ leadId, businessName, category, logo, scanDate, ranking, checks, plan, sources, email, calendlyUrl, prefill }: {
  leadId: string;
  businessName: string;
  /** What kind of business, as the visitor typed it on /book ("bakery"). */
  category?: string | null;
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
  // The move shown in full: a quick win if there is one, else the first high-impact one.
  const first = steps.find(i => i.effort === "low" && i.impact === "high") ?? steps.find(i => i.impact === "high") ?? steps[0];
  // Every site AI read but the business's own.
  const read = sources?.sources.filter(s => s.kind !== "own_site").length ?? 0;
  // Sites to get on whose answers named the top competitor.
  const rivalOn = rival ? sites.filter(s => s.named.some(n => squashedNameKey(n.name) === squashedNameKey(rival.name))).length : 0;

  // Each AI tool's share of buyer answers that named the business, best first.
  const engines = [...new Set(earned.map(c => c.engine))]
    .map(engine => {
      const asked = earned.filter(c => c.engine === engine);
      return { engine, named: asked.filter(c => c.mentioned).length, asked: asked.length };
    })
    .sort((a, b) => b.named / b.asked - a.named / a.asked);
  const grade = gradeFor(ranking);
  const pct = (n: number) => (earned.length ? Math.round((n / earned.length) * 100) : 0);

  const competitors = buyerCompetitors(earned);
  // The other buyer questions, each once: blurred under the one answer shown.
  const otherQuestions = [...new Set(earned.filter(c => c !== shown).map(c => c.promptText))];
  const scanned = scanDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

  return (
    <div className="mk-report">
      <header className="mk-audit-head">
        {logo && (
          // A data: address saved at setup, so next/image has nothing to optimise.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={businessName} className="mk-audit-logo" />
        )}
        <div className="mk-audit-head-text">
          <span className="mk-eyebrow">AI visibility audit</span>
          <h1 className="mk-report-title">{businessName}</h1>
          <p className="mk-report-meta">
            {scanned}{" · "}{plural(earned.length, "answer")} from {plural(engines.length, "AI tool")}
          </p>
        </div>
      </header>

      {/* How much of the audit is behind the account, said up front. */}
      <div className="mk-report-locked-bar">
        <span className="mk-lock-icon" aria-hidden="true" />
        <p>
          <strong>You&rsquo;re seeing a preview.</strong>{" "}
          Your free account unlocks{" "}
          {[
            plan && plan.total > 1 ? plural(plan.total, "step") : null,
            earned.length > 1 ? `${plural(earned.length, "AI answer")} word for word` : null,
            competitors.length > 1 ? plural(competitors.length, "competitor") : null,
            sites.length > 1 ? `${plural(sites.length, "website")} AI reads` : null,
          ].filter(Boolean).join(" · ")}
        </p>
        <a href="#create-account" className="mk-btn mk-btn-gold">Unlock everything</a>
      </div>

      <div className="mk-report-grid">
        <div className="mk-report-main">
          <section className="mk-report-card mk-report-score">
            <h2 className="mk-report-h mk-report-score-head">Competitor Report</h2>
            <div className="mk-report-dial">
              <ScoreDial value={ranking} label="Score" color={grade.stroke} />
              <span className={`mk-grade mk-grade-${grade.key}`}>{grade.label}</span>
            </div>
            <div className="mk-report-stats">
              <div className="mk-stat mk-stat-teal">
                <span className="mk-stat-label">You were named</span>
                <span className="mk-stat-value">{pct(named)}%</span>
                <span className="mk-stat-note">{named} of {earned.length} answers</span>
              </div>
              {rival && (
                <div className="mk-stat mk-stat-flag">
                  <span className="mk-stat-label">Top competitor</span>
                  <span className="mk-stat-value">{pct(rival.mentions)}%</span>
                  <span className="mk-stat-note">{rival.name}</span>
                </div>
              )}
              {best && (
                <div className="mk-stat mk-stat-plum">
                  <span className="mk-stat-label">Named you most</span>
                  <span className="mk-stat-value mk-stat-word">{engineName(best.engine)}</span>
                  <span className="mk-stat-note">{plural(best.count, "answer")}</span>
                </div>
              )}
            </div>
            <div className="mk-body mk-report-summary">
              <p>AI named you in {named} of {earned.length} answers when customers asked without using your name.</p>
              {best && <p>{engineName(best.engine)} named you most.</p>}
              {rival && (
                <p>It named <strong>{rival.name}</strong> instead in {rival.mentions} of those {earned.length} answers.</p>
              )}
            </div>
            {competitors.length > 0 && (
              <div className="mk-report-rivals">
                <h3 className="mk-report-sub">Who AI recommends instead</h3>
                <div className="mk-rival-row">
                  <span className="mk-rival-rank">1</span>
                  <span className="mk-rival-name">{competitors[0].name}</span>
                  <span className="mk-engine-track"><span className="mk-engine-fill mk-tone-orange" style={{ width: `${Math.max(pct(competitors[0].mentions), 2)}%` }} /></span>
                  <span className="mk-engine-pct">{plural(competitors[0].mentions, "answer")}</span>
                </div>
                <Locked
                  items={competitors.slice(1, 1 + LOCKED).map(c => c.name)}
                  label={`See all ${plural(competitors.length, "competitor")}`}
                />
              </div>
            )}
          </section>

          {plan && first && (
            <section className="mk-report-card mk-teaser-plan">
              <h2 className="mk-report-h">Your next steps to win customers from AI</h2>
              <p className="mk-body mk-report-lede">
                {`${plural(plan.total, "step")} to get ${businessName} recommended by AI`}
                {plan.quickWins ? `, ${plan.quickWins} of them quick wins you can do this week.` : "."}
              </p>
              <div className="mk-move">
                <div className="mk-move-tags">
                  <span className="mk-move-num">Step 1</span>
                  {first.effort === "low" && first.impact === "high" && <span className="mk-move-tag mk-move-quick">Quick win</span>}
                  {first.impact === "high" && <span className="mk-move-tag mk-move-impact">High impact</span>}
                  <span className="mk-move-tag">{EFFORT[first.effort]}</span>
                </div>
                <h3 className="mk-move-title">{moveTitle(first)}</h3>
                <p className="mk-move-why">{first.why}</p>
                <div className="mk-move-how">
                  <span>What to do</span>
                  <p>{first.how}</p>
                </div>
              </div>
              {plan.total > 1 && (
                <Locked
                  items={steps.filter(i => i !== first).slice(0, LOCKED).map(i => i.title)}
                  label={`Unlock all ${plural(plan.total, "step")} free`}
                />
              )}
            </section>
          )}

          {engines.length > 1 && (
            <section className="mk-report-card">
              <h2 className="mk-report-h">By AI tool</h2>
              <ul className="mk-engine-bars">
                {engines.map((e, i) => {
                  const share = e.asked ? Math.round((e.named / e.asked) * 100) : 0;
                  return (
                    <li key={e.engine} className={`mk-tone-${TONES[i % TONES.length]}`}>
                      <span className="mk-engine-name">{engineName(e.engine)}</span>
                      <span className="mk-engine-track">
                        <span className="mk-engine-fill" style={{ width: `${Math.max(share, 2)}%` }} />
                      </span>
                      <span className="mk-engine-pct">{share}%</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {shown && (
            <section className="mk-report-card">
              <h2 className="mk-report-h">{shown.mentioned ? "One answer" : "An answer you were left out of"}</h2>
              <p className="mk-report-ask">
                We asked {engineName(shown.engine)}: &ldquo;{shown.promptText}&rdquo;
              </p>
              <blockquote className="mk-teaser-quote">&ldquo;{excerpt(shown.answerText)}&rdquo;</blockquote>
              {earned.length > 1 && (
                <Locked
                  items={otherQuestions.slice(0, LOCKED).map(q => `\u201c${q}\u201d`)}
                  label={`Read all ${plural(earned.length, "answer")}`}
                />
              )}
            </section>
          )}

          {sources && sites.length > 0 && (
            <section className="mk-report-card mk-teaser-sources">
              <h2 className="mk-report-h">Where AI is reading</h2>
              <p className="mk-body mk-report-lede">
                {`AI read ${plural(read, "website")} to answer your customers. When it recommended someone else, it was reading ${sites.length} of them.`}
                {sites.length > 8 && ` Your plan lists the ${Math.min(sites.length, 8)} that matter most.`}
                {rival && rivalOn > 0 && ` ${rival.name} was named in answers from ${rivalOn} of them.`}
              </p>
              <div className="mk-teaser-step">
                <strong>{sites[0].domain}</strong>
              </div>
              {sites.length > 1 && (
                <Locked
                  items={sites.slice(1, 1 + BLURRED).map(s => s.domain)}
                  label={`See all ${plural(sites.length, "website")}`}
                />
              )}
            </section>
          )}

          <section className="mk-report-card mk-teaser-book">
            <h2 className="mk-report-h">Want us to walk you through it? Book 30 minutes</h2>
            {calendlyUrl ? (
              <div className="mk-calendly-bleed">
                <CalendlyEmbed url={calendlyUrl} prefill={{ ...prefill, email: email ?? undefined }} />
              </div>
            ) : (
              <p className="mk-body mk-report-lede">
                {email
                  ? "We'll reach out within one business day to set up a time."
                  : "Create your account and we'll reach out within one business day to set up a time."}
              </p>
            )}
          </section>
        </div>

        {/* Pinned beside the report on a wide screen, so the button is always in view;
            on a phone it sits right under the score. */}
        <aside className="mk-report-aside">
          <div className="mk-teaser-account" id="create-account">
            <h2 className="mk-report-h">Start getting customers from AI</h2>
            <p className="mk-body" style={{ marginTop: 10 }}>
              {category
                ? `People are asking AI for the best ${category.trim().toLowerCase()} near them right now. Make sure it sends them to ${businessName}.`
                : `People are asking AI who to choose right now. Make sure it sends them to ${businessName}.`}
            </p>
            <ul className="mk-account-gets">
              {plan && plan.total > 1 && (
                <li>{`All ${plan.total} steps to get recommended by AI`}</li>
              )}
              <li>Every AI answer about you, word for word</li>
              <li>Free, no credit card</li>
            </ul>
            <AccountForm leadId={leadId} askEmail={!email} />
            <p className="mk-field-hint" style={{ marginTop: 14 }}>
              Already have an account? <Link href="/login">Log in</Link>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * Real titles, names or domains, blurred (aria-hidden: there to see, not to
 * read), with a button over them that jumps to the sign-up card.
 */
function Locked({ items, label }: { items: string[]; label: string }) {
  return (
    <div className="mk-plan-locked">
      {items.length > 0 && (
        <ul className="mk-teaser-blurred" aria-hidden="true" data-blurred>
          {items.map(t => <li key={t}>{t}</li>)}
        </ul>
      )}
      <a href="#create-account" className="mk-btn mk-btn-gold mk-plan-unlock">
        <span className="mk-lock-icon" aria-hidden="true" />
        {label}
      </a>
    </div>
  );
}
