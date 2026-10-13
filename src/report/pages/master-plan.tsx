import { EffortImpact, EmptyState, NoteBox, NumberDot, PageTitle, ReportPage, card, clamp, text, type PageProps } from "@/report/components";
import { SeeAll } from "@/report/see-all";
import { planActions, quadrant } from "@/report/scoring";
import { color } from "@/report/tokens";
import type { Action } from "@/report/types";

/** Most rows on a sheet, and the height (px) the rows may take on the first sheet and on a continuation sheet. */
const MAX_ROWS = 8;
const FIRST_BUDGET = 670;
const REST_BUDGET = 730;
const ROW_GAP = 8;

const lines = (chars: number, perLine: number) => Math.max(1, Math.ceil(chars / perLine));

/** Row height from its text (the title is cut at two lines, the reason at three). */
function rowHeight(a: Action) {
  return 26 + 19 * Math.min(2, lines(a.title.length, 46)) + 4 + 17.5 * Math.min(3, lines(a.why.length, 84));
}

/** Split the actions into sheets by height, so no sheet takes more rows than fit. */
function pack(actions: Action[]) {
  const out: Action[][] = [];
  let cur: Action[] = [];
  let used = 0;
  for (const a of actions) {
    const h = rowHeight(a) + ROW_GAP;
    const budget = (out.length === 0 ? FIRST_BUDGET : REST_BUDGET) + ROW_GAP;
    if (cur.length && (cur.length >= MAX_ROWS || used + h > budget)) { out.push(cur); cur = []; used = 0; }
    cur.push(a); used += h;
  }
  out.push(cur);
  return out;
}

/** Little effort, big impact: the ones to do first. */
function isQuick(a: Action) {
  return quadrant(a.effort, a.impact) === "quick_win";
}

function listWords(ns: number[]) {
  if (ns.length <= 1) return String(ns[0] ?? "");
  return `${ns.slice(0, -1).join(", ")} and ${ns[ns.length - 1]}`;
}

function takeaway(actions: Action[]) {
  const quick = actions.map((a, i) => ({ a, n: i + 1 })).filter(x => isQuick(x.a));
  if (!quick.length) return "Start with number 1. It helps the most for the effort.";
  const who = quick.length === 1 ? "It takes" : quick.length === 2 ? "Both take" : "All take";
  const tracks = new Set(quick.map(x => x.a.track));
  const tail = tracks.size === 1 && tracks.has("facts")
    ? "fix the facts AI gets wrong."
    : tracks.size === 1 && tracks.has("visibility")
      ? "help AI name you more often."
      : quick.length === 1 ? "has a big impact." : "have a big impact.";
  return `Start with ${quick.length === 1 ? "number " : "numbers "}${listWords(quick.map(x => x.n))}. ${who} little effort and ${tail}`;
}

function ActionRow({ a, i }: { a: Action; i: number }) {
  const quick = isQuick(a);
  return (
    <div style={{ ...card, borderColor: quick ? color.client : color.rule, padding: "12px 16px", display: "grid", gridTemplateColumns: "30px 1fr", gap: 12, alignItems: "start" }}>
      <NumberDot n={i + 1} tone={quick ? "gold" : "ink"} size={28} />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: "19px", ...clamp(2) }}>{a.title}</span>
          <span style={{ flexShrink: 0 }}><EffortImpact effort={a.effort} impact={a.impact} /></span>
        </div>
        <span style={{ fontSize: 12.5, lineHeight: "17.5px", color: color.body, ...clamp(3) }}>{a.why}</span>
      </div>
    </div>
  );
}

const SECTION = "What to do first";

/**
 * The plan page of every multi-page report: that report's actions, in order, with how much work each
 * is and how much it helps. Up to eight fit on the sheet; any more follow on
 * continuation sheets.
 */
export function PlanPage({ r, ctx }: PageProps) {
  const actions = planActions(ctx.variant, r);
  const [shown, ...sheets] = pack(actions);
  const rest = actions.slice(shown.length);
  const starts = sheets.map((_, s) => shown.length + sheets.slice(0, s).reduce((n, rows) => n + rows.length, 0));

  return (
    <>
      <ReportPage r={r} ctx={ctx} section={SECTION} gap={16}>
        <PageTitle eyebrow="What to fix" title="What to do first">{shown.length ? takeaway(shown) : undefined}</PageTitle>
        {shown.length ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: ROW_GAP }}>
              {shown.map((a, i) => <ActionRow key={a.id} a={a} i={i} />)}
            </div>
            <p style={{ ...text.small, margin: 0 }}>
              In order of how much each helps for the work it takes. A gold number marks little effort and big impact.
              {rest.length > 0 && ` ${rest.length} more ${rest.length === 1 ? "action is" : "actions are"} listed after this page.`}
            </p>
          </>
        ) : (
          <EmptyState title="Nothing urgent to fix">This scan did not turn up any actions. We keep watching on the next check.</EmptyState>
        )}
        {shown.length > 0 && shown.length <= 4 && (
          <div style={{ marginTop: "auto" }}>
            <NoteBox title="How to use this page">Do them in order. Each one is small on its own, and AI tools pick up the changes over the following weeks.</NoteBox>
          </div>
        )}
      </ReportPage>
      {rest.length > 0 && (
        <SeeAll hiddenCount={rest.length} noun="actions">
          {sheets.map((rows, s) => (
            <ReportPage key={s} r={r} ctx={ctx} section={SECTION} gap={16} continued>
              <PageTitle eyebrow="What to fix" title="What to do next">The rest of the plan, still in order.</PageTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: ROW_GAP }}>
                {rows.map((a, i) => <ActionRow key={a.id} a={a} i={starts[s] + i} />)}
              </div>
            </ReportPage>
          ))}
        </SeeAll>
      )}
    </>
  );
}
