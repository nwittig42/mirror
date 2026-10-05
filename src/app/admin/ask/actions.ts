"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { competitors, nameVariations, practices } from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import { getAdapters } from "@/engines";
import { detectMention } from "@/core/mention";
import { classifyPosition } from "@/core/position";
import type { Engine, Position } from "@/core/types";

export interface LiveAnswer {
  engine: Engine;
  ok: boolean;
  error?: string;
  ms: number;
  answer?: string;
  citations?: string[];
  searchQueries?: string[];
  /** Only when a practice was chosen: was it named, and where. */
  mentioned?: boolean;
  position?: Position;
  namedOrder?: string[];
}

/**
 * Operators only: asks one engine one question, live, and returns everything
 * it said. The page calls this once per engine in parallel, so each answer
 * appears as soon as its engine finishes. Nothing is saved: this is for
 * seeing what AI says right now, not for scoring.
 */
export async function askEngine(engine: Engine, question: string, practiceId: string | null): Promise<LiveAnswer> {
  await requireOperator();
  const adapter = getAdapters().find(a => a.name === engine);
  const started = Date.now();
  if (!adapter) return { engine, ok: false, error: "This engine isn't set up (missing key).", ms: 0 };
  const text = question.trim().slice(0, 500);
  if (!text) return { engine, ok: false, error: "Type a question first.", ms: 0 };

  try {
    const result = await adapter.run(text);
    const live: LiveAnswer = {
      engine, ok: true, ms: Date.now() - started,
      answer: result.answer, citations: result.citations, searchQueries: result.searchQueries ?? [],
    };
    if (practiceId) {
      const db = getDb();
      const [[practice], variations, competitorRows] = await Promise.all([
        db.select().from(practices).where(eq(practices.id, practiceId)),
        db.select().from(nameVariations).where(eq(nameVariations.practiceId, practiceId)),
        db.select().from(competitors).where(eq(competitors.practiceId, practiceId)),
      ]);
      if (practice) {
        const names = Array.from(new Set([practice.name, ...variations.map(v => v.text)]));
        const known = competitorRows.filter(c => c.status === "active").map(c => c.name);
        const { position, namedOrder } = classifyPosition(result.answer, names, known);
        Object.assign(live, { mentioned: detectMention(result.answer, names), position, namedOrder });
      }
    }
    return live;
  } catch (err) {
    return { engine, ok: false, ms: Date.now() - started, error: (err instanceof Error ? err.message : String(err)).slice(0, 300) };
  }
}
