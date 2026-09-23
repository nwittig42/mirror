import { findMatches, type Match } from "@/core/mention";
import type { Position } from "@/core/types";

export function classifyPosition(
  answer: string, practiceVariations: string[], competitorNames: string[],
): { position: Position; competitorsMentioned: string[]; namedOrder: string[] } {
  // Get all matches with their span information
  const allMatches = findMatches(answer, [...practiceVariations, ...competitorNames]);

  // Classify matches by entity type
  interface MatchWithType extends Match {
    type: "practice" | "competitor";
  }

  const matchesWithType: MatchWithType[] = allMatches.map(m => ({
    ...m,
    type: practiceVariations.includes(m.name) ? "practice" : "competitor"
  }));

  // Suppress contained matches where the container is strictly longer and different entity type
  const survivingMatches: MatchWithType[] = [];
  for (const match of matchesWithType) {
    let isContained = false;
    for (const other of matchesWithType) {
      if (match === other) continue;
      // Check if match is fully contained in other
      const matchLen = match.end - match.start;
      const otherLen = other.end - other.start;
      if (
        match.start >= other.start &&
        match.end <= other.end &&
        otherLen > matchLen
      ) {
        // Check if they belong to different entity types
        const isSameEntity = match.type === other.type &&
          (match.type === "practice" ||
           (match.type === "competitor" && match.name === other.name));
        if (!isSameEntity) {
          isContained = true;
          break;
        }
      }
    }
    if (!isContained) {
      survivingMatches.push(match);
    }
  }

  // Build entities list, collapsing practice variations into single entity at earliest hit
  const entities: string[] = [];
  let practiceSeen = false;
  for (const match of survivingMatches) {
    if (match.type === "practice") {
      if (!practiceSeen) {
        entities.push("__PRACTICE__");
        practiceSeen = true;
      }
    } else {
      if (!entities.includes(match.name)) {
        entities.push(match.name);
      }
    }
  }

  // Extract and deduplicate competitor mentions
  const competitorsMentioned = Array.from(new Set(
    survivingMatches
      .filter(m => m.type === "competitor")
      .map(m => m.name)
  ));

  // Classify position
  const idx = entities.indexOf("__PRACTICE__");
  const position: Position = idx === -1 ? "absent" : idx === 0 ? "first" : idx <= 2 ? "top3" : "mentioned";

  // Every business named, in order of first appearance, with the practice
  // under its canonical (first) name. This is what the head-to-head competitor
  // table renders; `position` alone loses which competitors came first.
  const namedOrder = entities.map(e => (e === "__PRACTICE__" ? practiceVariations[0] : e));

  return { position, competitorsMentioned, namedOrder };
}
