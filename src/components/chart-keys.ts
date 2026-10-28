import type { SourceKind } from "@/core/citations";
import type { Engine } from "@/core/types";

/** The colour of each kind of website, wherever sources are charted. A background class from the theme. */
export const KIND_FILL: Record<SourceKind, string> = {
  own_site: "bg-gold",
  reviews: "bg-ink-soft",
  social: "bg-ring-facts",
  reference: "bg-teal",
  google: "bg-plum",
  press: "bg-sun",
  other: "bg-bone",
};

/** Each AI tool's own website (for its icon) and its ring colour: gold for all, the icon tells them apart. */
export const TOOL: Record<Engine, { site: string; stroke: string }> = {
  openai: { site: "chatgpt.com", stroke: "stroke-gold" },
  anthropic: { site: "claude.ai", stroke: "stroke-gold" },
  gemini: { site: "gemini.google.com", stroke: "stroke-gold" },
  perplexity: { site: "perplexity.ai", stroke: "stroke-gold" },
  grok: { site: "x.ai", stroke: "stroke-gold" },
  google: { site: "google.com", stroke: "stroke-gold" },
};
