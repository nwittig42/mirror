import type { Engine, EngineAnswer } from "@/core/types";

export interface EngineAdapter {
  name: Engine;
  run(prompt: string): Promise<EngineAnswer>;
}

export class EngineError extends Error {
  constructor(
    public engine: Engine,
    public status: number,
    body: string,
  ) {
    super(`${engine} ${status}: ${body.slice(0, 300)}`);
  }
}

const TIMEOUT_MS = 120_000;

/**
 * Wraps fetch with a per-request timeout. On abort/timeout, throws a uniform
 * EngineError(engine, 408, "timeout") instead of letting the raw AbortError
 * propagate, so adapters can treat timeouts like any other engine failure.
 */
export async function engineFetch(
  engine: Engine,
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
      throw new EngineError(engine, 408, "timeout");
    }
    throw err;
  }
}
