import { EmptyState, ReportPage, StagePill, nn, text, type PageProps } from "@/report/components";
import { SeeAll } from "@/report/see-all";
import { actionsFor, effortColor, impactColor, levelLabel, quadrant } from "@/report/scoring";
import { color, statusColor } from "@/report/tokens";
import type { Action, Level } from "@/report/types";

const LV: Record<Level, number> = { low: 1, medium: 2, high: 3 };
/** Rows that fit on one continuation sheet. */
const ROWS_PER_SHEET = 9;

/** Pip fill and label color. Medium uses the stronger amber, as in the design. */
function levelColors(l: Level, kind: "effort" | "impact") {
  const c = kind === "effort" ? effortColor(l) : impactColor(l);
  const fill = l === "medium" ? statusColor.warn.strong : c.fill;
  const txt = kind === "impact" && l === "low" ? color.muted : c.text;
  return { fill, text: txt };
}

function isQuick(a: Action) {
  return quadrant(a.effort, a.impact) === "quick_win";
}

function dotColor(a: Action, i: number) {
  return isQuick(a) ? statusColor.good.fill : i < 3 ? color.client : color.subtle;
}

function listWords(ns: number[]) {
  if (ns.length <= 1) return String(ns[0] ?? "");
  return `${ns.slice(0, -1).join(", ")} and ${ns[ns.length - 1]}`;
}

function takeaway(actions: Action[]) {
  const quick = actions.map((a, i) => ({ a, n: i + 1 })).filter(x => isQuick(x.a));
  if (!quick.length) return `Start with 1. It helps the most for the effort.`;
  const who = quick.length === 1 ? "It takes" : quick.length === 2 ? "Both take" : "All take";
  const tracks = new Set(quick.map(x => x.a.track));
  const tail = tracks.size === 1 && tracks.has("facts")
    ? "fix the facts AI gets wrong."
    : tracks.size === 1 && tracks.has("visibility")
      ? "help AI name you more often."
      : quick.length === 1 ? "has a big impact." : "have a big impact.";
  return `Start with ${listWords(quick.map(x => x.n))}. ${who} little effort and ${tail}`;
}

function Meter({ label, level, kind }: { label: string; level: Level; kind: "effort" | "impact" }) {
  const c = levelColors(level, kind);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "46px 60px 1fr", alignItems: "center", gap: 6 }}>
      <span style={text.small}>{label}</span>
      <div style={{ display: "flex", gap: 3 }} aria-hidden="true">
        {[1, 2, 3].map(p => (
          <span key={p} style={{ width: 17, height: 8, borderRadius: 3, background: p <= LV[level] ? c.fill : color.rule }} />
        ))}
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color: c.text }}>{levelLabel[level]}</span>
    </div>
  );
}

function ActionRow({ a, i }: { a: Action; i: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 170px", gap: 14, padding: "12px 14px", borderRadius: 14, border: `1px solid ${color.rule}`, background: isQuick(a) ? statusColor.good.soft : "#FFFFFF", alignItems: "center" }}>
      <span style={{ width: 32, height: 32, borderRadius: 10, background: dotColor(a, i), color: "#FFFFFF", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.3 }}>{a.title}</span>
        <span style={{ fontSize: 12.5, lineHeight: 1.4, color: color.text2 }}>{a.why}</span>
        {a.fixes && <span style={text.small}>Fixes: {a.fixes}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Meter label="Effort" level={a.effort} kind="effort" />
        <Meter label="Impact" level={a.impact} kind="impact" />
      </div>
    </div>
  );
}

/** Effort × impact matrix with numbered dots; overlapping dots are nudged sideways. */
function Matrix({ actions }: { actions: Action[] }) {
  const seen: Record<string, number> = {};
  const dots = actions.map((a, i) => {
    const e = LV[a.effort];
    const im = LV[a.impact];
    const key = `${e}-${im}`;
    const k = seen[key] ?? 0;
    seen[key] = k + 1;
    // High-effort dots sit at the right edge, so they nudge left instead.
    const x = [0, 12, 128, 196][e] + (e === 3 ? -k : k) * 30;
    const y = [0, 146, 104, 24][im];
    return { n: i + 1, x, y, bg: dotColor(a, i) };
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ transform: "rotate(-90deg)", fontSize: 10, fontWeight: 700, color: color.subtle, whiteSpace: "nowrap" }}>Impact ↑</span>
        </div>
        <div style={{ position: "relative", width: 236, height: 186, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gridTemplateRows: "repeat(2, minmax(0, 1fr))", gap: 3 }}>
          <div style={{ background: statusColor.good.tint, borderRadius: "10px 0 0 0", padding: "6px 8px", fontSize: 10, fontWeight: 800, color: statusColor.good.text }}>QUICK WINS</div>
          <div style={{ background: statusColor.warn.tint, borderRadius: "0 10px 0 0", padding: "6px 8px", fontSize: 10, fontWeight: 800, color: statusColor.warn.text, textAlign: "right" }}>BIG PROJECTS</div>
          <div style={{ background: color.track, borderRadius: "0 0 0 10px", padding: "6px 8px", fontSize: 10, fontWeight: 800, color: color.muted, display: "flex", alignItems: "flex-end" }}>EASY EXTRAS</div>
          <div style={{ background: color.track, borderRadius: "0 0 10px 0", padding: "6px 8px", fontSize: 10, fontWeight: 800, color: color.muted, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>LATER</div>
          {dots.map(d => (
            <span key={d.n} style={{ position: "absolute", left: d.x, top: d.y, width: 26, height: 26, borderRadius: 13, boxSizing: "border-box", border: "2px solid #FFFFFF", background: d.bg, color: "#FFFFFF", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(15,23,42,0.25)" }}>{d.n}</span>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: 22, fontSize: 10, fontWeight: 700, color: color.subtle }}>
        <span>Low effort</span><span>High effort →</span>
      </div>
    </div>
  );
}

export function PlanPage({ r, ctx }: PageProps) {
  const shown = actionsFor("master", r);
  const rest = r.actions.slice(shown.length);
  const section = `${nn(ctx.index)} · What to do first`;
  const sheets: Action[][] = [];
  for (let i = 0; i < rest.length; i += ROWS_PER_SHEET) sheets.push(rest.slice(i, i + ROWS_PER_SHEET));

  return (
    <>
      <ReportPage r={r} ctx={ctx} section={section}>
        {shown.length ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 28, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <StagePill stage="fix" />
                <h1 style={text.h1}>What to do first</h1>
                <p style={text.take}>{takeaway(shown)}</p>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: color.muted }}>
                  Actions are ordered by how much they help for the effort. The chart shows where each sits: the green corner is the sweet spot.
                </p>
              </div>
              <Matrix actions={shown} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {shown.map((a, i) => <ActionRow key={a.id} a={a} i={i} />)}
            </div>
            {rest.length > 0 && (
              <p style={{ ...text.small, margin: 0 }}>
                Plus {rest.length} more action{rest.length > 1 ? "s" : ""}, listed after this page.
              </p>
            )}
          </>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <StagePill stage="fix" />
              <h1 style={text.h1}>What to do first</h1>
            </div>
            <EmptyState title="Nothing urgent to fix">This scan didn’t turn up any actions. We’ll keep watching on the next re-check.</EmptyState>
          </>
        )}
      </ReportPage>
      {rest.length > 0 && (
        <SeeAll hiddenCount={rest.length} noun="actions">
          {sheets.map((rows, s) => (
            <ReportPage key={s} r={r} ctx={ctx} section={section} continued>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <StagePill stage="fix" />
                <h1 style={text.h1}>What to do next</h1>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: color.muted }}>The rest of the plan, still in priority order.</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rows.map((a, i) => <ActionRow key={a.id} a={a} i={shown.length + s * ROWS_PER_SHEET + i} />)}
              </div>
            </ReportPage>
          ))}
        </SeeAll>
      )}
    </>
  );
}
