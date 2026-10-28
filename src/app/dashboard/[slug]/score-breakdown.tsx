import { ENGINE_NAMES } from "@/core/coverage";
import { POSITION_WEIGHT } from "@/core/scoring";

interface BreakdownCheck { engine: string; promptKind: string; mentioned: boolean; position?: string | null }

// What a shown score means, in the same bands the audit page colours by.
function band(score: number | null) {
  if (score === null) return null;
  if (score < 40) return { label: "Needs work", color: "#b4412f", soft: "#f6e0db", say: "AI rarely names you when buyers ask. Most answers send them to someone else." };
  if (score < 70) return { label: "Fair", color: "#b7791f", soft: "#f7ead0", say: "AI knows you, but names other businesses more often and higher up." };
  return { label: "Strong", color: "#4f6b4a", soft: "#e2e9dd", say: "AI names you often and near the top. Keep it there." };
}

/**
 * What goes into "Recommended by AI", from the scan's own answers: how often
 * AI named the business (half the score), how high it placed it (a fifth),
 * and how many AI tools named it at all (the rest). Buyer questions only, as
 * the score counts them. Shown under the score rings on both overviews.
 */
export function ScoreBreakdown({ score, checks }: { score: number | null; checks: BreakdownCheck[] }) {
  const earned = checks.filter(c => c.promptKind !== "branded");
  const named = earned.filter(c => c.mentioned).length;
  const often = earned.length ? Math.round((named / earned.length) * 100) : 0;
  const category = checks.filter(c => c.promptKind === "category");
  const placed = category.length
    ? Math.round((category.reduce((s, c) => s + (POSITION_WEIGHT[c.position as keyof typeof POSITION_WEIGHT] ?? 0), 0) / category.length) * 100)
    : 0;
  const firsts = category.filter(c => c.position === "first").length;
  const tools = [...new Set(earned.map(c => c.engine))];
  const naming = tools.filter(t => earned.some(c => c.engine === t && c.mentioned));
  const missing = tools.filter(t => !naming.includes(t)).map(t => ENGINE_NAMES[t as keyof typeof ENGINE_NAMES] ?? t);
  const b = band(score);

  const parts = [
    {
      label: "How often AI names you",
      weight: "59% of the score",
      value: often,
      shown: `${often}%`,
      note: `Named in ${named} of ${earned.length} answers when buyers asked without using your name.`,
      color: "var(--color-teal)",
    },
    {
      label: "How high it places you",
      weight: "23% of the score",
      value: placed,
      shown: `${placed}/100`,
      note: firsts
        ? `Named first in ${firsts} of ${category.length} answers. First place counts most, then the top three.`
        : "Never named first yet. First place counts most, then the top three.",
      color: "var(--color-ring-visibility)",
    },
    {
      label: "How many AI tools name you",
      weight: "18% of the score",
      value: tools.length ? Math.round((naming.length / tools.length) * 100) : 0,
      shown: `${naming.length} of ${tools.length}`,
      note: missing.length ? `Not named at all by ${missing.join(", ")}.` : "Every AI tool we asked named you at least once.",
      color: "var(--color-plum)",
    },
  ];

  return (
    <div className="mt-6 border-t border-line pt-6">
      {b && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full px-3 py-1 text-[13px] font-semibold" style={{ color: b.color, background: b.soft }}>{b.label}</span>
          <p className="text-[15px] leading-relaxed text-ink">{b.say}</p>
        </div>
      )}
      <p className="eyebrow mt-6">What&apos;s in your Recommended by AI score</p>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        {parts.map(p => (
          <div key={p.label} className="rounded-[14px] border border-line p-5" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${p.color} 9%, transparent), transparent 70%)` }}>
            <p className="text-[13.5px] font-medium text-muted">{p.label}</p>
            <p className="display mt-2 text-[34px] leading-none tabular-nums" style={{ color: p.color }}>{p.shown}</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-bone">
              <div className="h-full rounded-full" style={{ width: `${Math.max(p.value, 2)}%`, background: p.color }} />
            </div>
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">{p.note}</p>
            <p className="mt-1.5 text-[12px] font-medium text-muted">{p.weight}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[13px] text-muted">Scores run from 30 to 100. Under 40 needs work, 40 to 69 is fair, 70 and up is strong.</p>
    </div>
  );
}
