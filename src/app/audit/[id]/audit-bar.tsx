"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AuditProgress, AuditStage } from "@/services/audit-progress";

const POLL_MS = 4000;
/** Nothing changes after these, so polling stops. */
const SETTLED: ReadonlySet<AuditStage> = new Set(["done", "failed", "not-started"]);

const ProgressContext = createContext<AuditProgress | null>(null);

/** The audit's progress as last heard, for the bar and for the step that waits on the result. */
export function useAuditProgress(): AuditProgress {
  const progress = useContext(ProgressContext);
  if (!progress) throw new Error("useAuditProgress needs an AuditProgressProvider above it");
  return progress;
}

/** The same, or null outside a provider, for a form that also renders on its own. */
export function useAuditProgressIfAny(): AuditProgress | null {
  return useContext(ProgressContext);
}

/**
 * Keeps the audit's progress current for everything on the page. Starts from
 * what the server rendered, then asks /api/audit/<id> every few seconds until
 * it settles. When the audit finishes, the page is refreshed once so the
 * server can say so wherever it matters.
 */
export function AuditProgressProvider({ leadId, initial, children }: {
  leadId: string;
  initial: AuditProgress;
  children: ReactNode;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState(initial);
  const settledAtStart = SETTLED.has(initial.stage);

  useEffect(() => {
    if (settledAtStart) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/audit/${leadId}`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const next = (await res.json()) as AuditProgress;
        if (stopped) return;
        setProgress(next);
        if (SETTLED.has(next.stage)) {
          stopped = true;
          clearInterval(timer);
          router.refresh();
        }
      } catch {
        // A dropped request is retried on the next tick.
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [leadId, router, settledAtStart]);

  return <ProgressContext.Provider value={progress}>{children}</ProgressContext.Provider>;
}

/** "2:07" from milliseconds. */
function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** What the audit is doing right now, in a visitor's words. Names only the tools actually being asked. */
export function stageLine(p: AuditProgress): string {
  switch (p.stage) {
    case "reading": return p.percent >= 15 ? "Writing the questions your customers ask" : "Reading your website";
    case "asking": return `Asking ${p.asking}`;
    case "writing": return "Scoring your answers";
    default: return "";
  }
}

/**
 * The audit's progress, pinned to the top of every onboarding step. It says
 * what the audit is doing and how far along it is, and when the result is
 * ready. The result itself is never shown here: it opens in the dashboard.
 */
export function AuditBar({ startedAt }: {
  /** When the audit was started, epoch ms, so the clock survives the page moving between steps. */
  startedAt: number;
}) {
  const progress = useAuditProgress();
  const running = !SETTLED.has(progress.stage);
  // Ticks on the client only: the server render carries no clock, so the two never disagree.
  const [elapsed, setElapsed] = useState<number | null>(null);
  useEffect(() => {
    if (!running) return;
    const tick = () => setElapsed(Date.now() - startedAt);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [running, startedAt]);

  // An audit that failed or never started has no progress to show; the page says why instead.
  if (progress.stage === "failed" || progress.stage === "not-started") return null;

  const done = progress.stage === "done";
  const name = progress.businessName;
  return (
    <div className="mk-audit-bar" role="status">
      <div className="mk-audit-bar-inner">
        <div className="mk-audit-bar-head">
          <span className="title">{done ? "Your audit is ready" : name ? `Your audit · ${name}` : "Your audit"}</span>
          {!done && (
            <span className="stage">
              {stageLine(progress)}…
              {progress.stage === "asking" && progress.total !== null && (
                <span className="count"> {progress.answers} of {progress.total} answers in</span>
              )}
            </span>
          )}
          {!done && <span className="clock">{elapsed === null ? "About a minute or two" : clock(elapsed)}</span>}
        </div>
        <div
          className={done ? "mk-progress" : "mk-progress mk-progress-live"}
          role="progressbar"
          aria-label="Audit progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
        >
          <span style={{ width: `${progress.percent}%` }} />
        </div>
      </div>
    </div>
  );
}

/** The audit's stages in order, as a visitor reads them. */
function stages(p: AuditProgress): string[] {
  return ["Reading your website", "Writing the questions your customers ask", `Asking ${p.asking}`, "Scoring your answers"];
}

/** Which stage is under way: 0-3, or 4 once the audit is done. */
function stageIndex(p: AuditProgress): number {
  switch (p.stage) {
    case "reading": return p.percent >= 15 ? 1 : 0;
    case "asking": return 2;
    case "writing": return 3;
    default: return 4;
  }
}

/**
 * The last step: nothing left to fill in, so the visitor watches the audit
 * work through its stages and is taken to their dashboard the moment the
 * result is ready.
 */
export function WaitingStep() {
  const progress = useAuditProgress();
  const router = useRouter();
  const done = progress.stage === "done";
  useEffect(() => {
    if (done) router.push("/app");
  }, [done, router]);

  const current = stageIndex(progress);
  return (
    <div className="mk-form-card" role="status">
      <span className="mk-eyebrow">{done ? "All set" : "Almost there"}</span>
      <h2 className="mk-display mk-h3" style={{ marginTop: 14 }}>
        {done ? "Opening your audit" : "Your audit opens as soon as it's ready"}
      </h2>
      <p className="mk-body" style={{ marginTop: 12 }}>
        {done
          ? "Taking you to your dashboard now."
          : "You don't need to do anything. Here is what we're doing right now."}
      </p>
      {!done && (
        <>
          <ol className="mk-audit-steps" aria-live="polite">
            {stages(progress).map((label, i) => (
              <li key={label} className={i < current ? "done" : i === current ? "now" : undefined}>
                <span>{label}</span>
                {i === 2 && progress.stage === "asking" && progress.total !== null && (
                  <span className="count">{progress.answers} of {progress.total} answers in</span>
                )}
              </li>
            ))}
          </ol>
          <p className="mk-field-hint" style={{ marginTop: 18 }}>Then your dashboard opens by itself.</p>
        </>
      )}
      {done && (
        <a className="mk-btn mk-btn-block" href="/app" style={{ marginTop: 22 }}>Open my audit</a>
      )}
    </div>
  );
}
