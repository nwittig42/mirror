import type { SourceKind } from "@/core/citations";
import type { Engine } from "@/core/types";

/** The colour of each kind of website, wherever sources are charted. A background class from the theme. */
export const KIND_FILL: Record<SourceKind, string> = {
  own_site: "bg-gold",
  reviews: "bg-ring-visibility",
  social: "bg-ring-facts",
  reference: "bg-teal",
  google: "bg-plum",
  press: "bg-sun",
  other: "bg-ring-overall",
};

/** Each AI tool's own website (for its icon) and its ring colour. */
export const TOOL: Record<Engine, { site: string; stroke: string }> = {
  openai: { site: "chatgpt.com", stroke: "stroke-teal" },
  anthropic: { site: "claude.ai", stroke: "stroke-ring-visibility" },
  gemini: { site: "gemini.google.com", stroke: "stroke-sun" },
  perplexity: { site: "perplexity.ai", stroke: "stroke-ring-facts" },
  grok: { site: "x.ai", stroke: "stroke-ring-overall" },
  google: { site: "google.com", stroke: "stroke-plum" },
};
