"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuditProgress, AuditStage } from "@/services/audit-progress";

const POLL_MS = 4000;
/** Nothing changes after these, so polling stops. */
const SETTLED: ReadonlySet<AuditStage> = new Set(["done", "failed", "not-started"]);

const STEPS = [
  "Reading your website",
  "Writing the questions your customers ask",
  "Asking ChatGPT, Claude, Gemini, Grok and Perplexity",
  "Writing your report",
];

/**
 * What the status line under the bar cycles through while each step runs, so
 * the wait has something moving even between polls. Index matches STEPS.
 */
const STATUS_LINES = [
  ["Loading your home page", "Finding your services and prices", "Reading your hours and location", "Looking for what makes you different"],
  ["Thinking like a customer in your area", "Writing what people ask before they buy", "Picking the questions that matter most"],
  ["Asking ChatGPT", "Asking Claude", "Asking Gemini", "Asking Grok", "Asking Perplexity", "Checking who AI recommends instead", "Noting the websites AI reads"],
  ["Scoring how often AI names you", "Ranking your competitors", "Picking your first fixes"],
];
const STATUS_MS = 2600;

/** "2:07" from milliseconds. */
function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Which of STEPS is under way. "reading" covers the first two: past 15% the questions are being written. */
function stepIndex(p: AuditProgress): number {
  switch (p.stage) {
    case "reading": return p.percent >= 15 ? 1 : 0;
    case "asking": return 2;
    case "writing": return 3;
    default: return STEPS.length;
  }
}

/**
 * The left column: how far the audit has got. Starts from the progress the
 * server rendered, then asks /api/audit/<id> every few seconds until it
 * settles. When it finishes, the page is refreshed once so the server can
 * render the results above it.
 */
export function AuditLive({ leadId, initial, notStarted }: {
  leadId: string;
  initial: AuditProgress;
  /** Why an audit that didn't start didn't, worked out on the server. */
  notStarted?: "repeat" | "capacity";
}) {
  const router = useRouter();
  const [progress, setProgress] = useState(initial);
  const settledAtStart = SETTLED.has(initial.stage);
  // Both tick on the client only; the server render shows the first line and 0:00.
  const [tick, setTick] = useState(0);
  const [elapsed, setElapsed] = useState(0);

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
          if (next.stage === "done") router.refresh();
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

  const running = !SETTLED.has(progress.stage);
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const status = setInterval(() => setTick(t => t + 1), STATUS_MS);
    const seconds = setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => {
      clearInterval(status);
      clearInterval(seconds);
    };
  }, [running]);

  const current = stepIndex(progress);
  const lines = STATUS_LINES[current] ?? [];
  const statusLine = lines.length ? lines[tick % lines.length] : null;
  // Failed and not-started won't finish by themselves, so neither the running heading nor the time applies.
  const stuck = progress.stage === "failed" || progress.stage === "not-started";
  const heading = progress.stage === "done" ? "Your audit is ready" : stuck ? "Your audit" : "Your audit is running";

  return (
    <div>
      <span className="mk-eyebrow">{progress.businessName ? `Free audit · ${progress.businessName}` : "Free audit"}</span>
      <h1 className="lp-h2" style={{ marginTop: 18 }}>{heading}</h1>
      {!stuck && <p className="mk-lede" style={{ fontSize: 17, marginTop: 12 }}>This takes 5-7 minutes.</p>}

      {progress.stage === "failed" ? (
        <p className="mk-form-alert" role="status" style={{ marginTop: 28 }}>
          {"Something went wrong on our side. We'll finish your audit by hand and email it to you."}
        </p>
      ) : progress.stage === "not-started" ? (
        <p className="mk-form-alert" role="status" style={{ marginTop: 28 }}>
          {notStarted === "repeat"
            ? "We've already started an audit for this site today. Leave your details and we'll send it."
            : "We're at capacity today. Leave your details and we'll run it by hand."}
        </p>
      ) : (
        <>
          <div
            className="mk-progress mk-progress-live"
            role="progressbar"
            aria-label="Audit progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
          >
            <span style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="mk-audit-status">
            {/* Keyed so each new line fades in. Hidden from screen readers: the steps below carry the real progress. */}
            {statusLine && <span key={statusLine} className="line" aria-hidden="true">{statusLine}…</span>}
            <span className="clock">{clock(elapsed)} elapsed</span>
          </div>
          <ol className="mk-audit-steps" aria-live="polite">
            {STEPS.map((step, i) => (
              <li key={step} className={i < current ? "done" : i === current ? "now" : undefined}>
                <span>{step}</span>
                {i === 2 && progress.stage === "asking" && progress.total !== null && (
                  <span className="count">Answers in: {progress.answers} of {progress.total}</span>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
