import { detectNames } from "@/core/mention";
import type { Position } from "@/core/types";

export function classifyPosition(
  answer: string, practiceVariations: string[], competitorNames: string[],
): { position: Position; competitorsMentioned: string[] } {
  const competitorsMentioned = detectNames(answer, competitorNames);
  const ordered = detectNames(answer, [...practiceVariations, ...competitorNames]);
  // collapse practice-name variations into one entity at earliest hit
  const entities: string[] = [];
  let practiceSeen = false;
  for (const name of ordered) {
    if (practiceVariations.includes(name)) {
      if (!practiceSeen) { entities.push("__PRACTICE__"); practiceSeen = true; }
    } else if (!entities.includes(name)) entities.push(name);
  }
  const idx = entities.indexOf("__PRACTICE__");
  const position: Position = idx === -1 ? "absent" : idx === 0 ? "first" : idx <= 2 ? "top3" : "mentioned";
  return { position, competitorsMentioned };
}
