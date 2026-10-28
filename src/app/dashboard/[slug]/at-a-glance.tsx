import Link from "next/link";

/** "1 in 5", "about half", "3 in 4": how often AI named the business, said the way a person would. */
export function howOften(named: number, total: number): string {
  if (total === 0 || named === 0) return "none";
  if (named === total) return "every one";
  const share = named / total;
  if (share >= 0.45 && share <= 0.55) return "about half";
  if (share < 0.5) return `about 1 in ${Math.round(total / named)}`;
  // Above half: the share left out, said the other way round ("3 in 4").
  const missed = Math.max(1, Math.round(total / (total - named)));
  return `about ${missed - 1} in ${missed}`;
}

/** The three bands a shown score falls in, the same ones the audit page uses. */
export function scoreBand(score: number): { label: string; say: string; tone: string } {
  if (score < 40) return { label: "Needs work", say: "AI rarely recommends you. Most answers send buyers to someone else.", tone: "text-ring-facts" };
  if (score < 70) return { label: "Fair", say: "AI knows you, but recommends other businesses more often and higher up.", tone: "text-ring-visibility" };
  return { label: "Strong", say: "AI recommends you often and near the top. The job now is keeping it there.", tone: "text-ring-overall" };
}

/** Each band's ring colour, as a stroke class from the theme. */
const BAND_STROKE: Record<string, string> = { "Needs work": "stroke-ring-facts", Fair: "stroke-ring-visibility", Strong: "stroke-ring-overall" };

/**
 * The score as a ring that fills to it in its band's colour, the number in
 * the middle. Shown scores run from 30 to 100, so the ring fills over that span.
 */
function ScoreCircle({ score, label, size = 112 }: { score: number; label: string; size?: number }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * Math.min(1, Math.max(0.02, (score - 30) / 70));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Score ${score} out of 100, ${label}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`} fill="none" strokeWidth={stroke}>
          <circle cx={size / 2} cy={size / 2} r={r} className="stroke-bone" />
          <circle cx={size / 2} cy={size / 2} r={r} className={BAND_STROKE[label]} strokeLinecap="round" strokeDasharray={`${filled} ${circ}`} />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="display text-[34px] leading-none tabular-nums text-ink">{score}</span>
        <span className="mt-0.5 text-[12px] text-muted">of 100</span>
      </div>
    </div>
  );
}

/**
 * The top of the Overview, for someone who has never seen an AI visibility
 * report: one sentence on how often AI recommends them, then three short
 * rows (what the score means, who AI picks instead, what to do first). Every
 * number is from the latest scan's buyer questions.
 */
export function AtAGlance({ slug, practiceName, named, total, tools, score, competitor, firstStep, steps }: {
  slug: string;
  practiceName: string;
  /** Buyer-question answers that named the business, out of `total`. */
  named: number;
  total: number;
  /** The AI tools asked, by name. */
  tools: string[];
  /** The Recommended by AI score as shown (30 to 100), or null before there is one. */
  score: number | null;
  competitor: { name: string; mentions: number } | null;
  firstStep: { title: string } | null;
  steps: number;
}) {
  const often = howOften(named, total);
  const band = score === null ? null : scoreBand(score);
  const toolList = tools.length > 1 ? `${tools.slice(0, -1).join(", ")} and ${tools[tools.length - 1]}` : tools[0] ?? "AI tools";
  const ahead = competitor && competitor.mentions > named;

  return (
    <section className="rounded-[16px] border border-line bg-paper p-6 shadow-[0_1px_2px_rgba(26,26,24,0.04)] sm:p-8" aria-labelledby="glance-title">
      <p className="eyebrow">At a glance</p>
      <h2 id="glance-title" className="display mt-2 text-[26px] leading-snug text-ink sm:text-[30px]">
        {often === "none"
          ? <>AI didn&apos;t recommend {practiceName} in any of the answers we checked.</>
          : often === "every one"
            ? <>AI recommended {practiceName} in every answer we checked.</>
            : <>AI recommends {practiceName} in {often === "about half" ? "about half the" : often} answers.</>}
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        We asked {toolList} {total} questions your customers ask. You came up in {named}.
      </p>

      <div className="mt-6 grid gap-px overflow-hidden rounded-[12px] border border-line bg-line md:grid-cols-3">
        <div className="bg-paper p-5">
          <p className="text-[13px] font-medium text-muted">Your score</p>
          {score !== null && band ? (
            <>
              <div className="mt-3 flex items-center gap-4">
                <ScoreCircle score={score} label={band.label} />
                <div className="min-w-0">
                  <p className={`text-[17px] font-semibold ${band.tone}`}>{band.label}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{band.say}</p>
                </div>
              </div>
              <p className="mt-4 text-[12.5px] text-muted">Under 40 needs work · 40 to 69 is fair · 70 and up is strong</p>
            </>
          ) : <p className="mt-1 text-[14px] text-ink-soft">Your score shows here when the scan finishes.</p>}
        </div>
        <div className="bg-paper p-5">
          <p className="text-[13px] font-medium text-muted">{ahead ? "Who AI picks instead" : "Closest competitor"}</p>
          {competitor ? (
            <>
              <p className="display mt-1 text-[22px] leading-snug text-ink">{competitor.name}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                Recommended {competitor.mentions} time{competitor.mentions === 1 ? "" : "s"}, you {named}.
                {ahead ? " When AI skips you, this is often who it sends buyers to." : " You're ahead of them."}
              </p>
              <Link href={`/dashboard/${slug}/competitors`} className="mt-3 inline-block text-[13.5px] font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                See every competitor
              </Link>
            </>
          ) : <p className="mt-1 text-[14px] text-ink-soft">AI named no other business in these answers.</p>}
        </div>
        <div className="bg-paper p-5">
          <p className="text-[13px] font-medium text-muted">Do this first</p>
          {firstStep ? (
            <>
              <p className="display mt-1 text-[22px] leading-snug text-ink">{firstStep.title}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                The quickest step with the biggest effect, out of {steps} we found.
              </p>
              <Link href={`/dashboard/${slug}/fixes`} className="btn-ink mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13.5px] font-semibold">
                See how <span aria-hidden="true">→</span>
              </Link>
            </>
          ) : <p className="mt-1 text-[14px] text-ink-soft">Nothing urgent. AI already recommends you where it counts.</p>}
        </div>
      </div>
    </section>
  );
}
