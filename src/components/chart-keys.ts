import type { SourceKind } from "@/core/citations";
import type { Engine } from "@/core/types";

/** The colour of each kind of website, wherever sources are charted. A background class from the theme. */
export const KIND_FILL: Record<SourceKind, string> = {
  own_site: "bg-gold",
  reviews: "bg-ring-facts",
  social: "bg-plum",
  reference: "bg-teal",
  google: "bg-ring-overall",
  press: "bg-sun",
  other: "bg-muted",
};

/** Each AI tool's own website (for its icon) and its ring colour. */
export const TOOL: Record<Engine, { site: string; stroke: string }> = {
  openai: { site: "chatgpt.com", stroke: "stroke-teal" },
  anthropic: { site: "claude.ai", stroke: "stroke-ring-facts" },
  gemini: { site: "gemini.google.com", stroke: "stroke-sun" },
  perplexity: { site: "perplexity.ai", stroke: "stroke-plum" },
  grok: { site: "x.ai", stroke: "stroke-ink" },
  google: { site: "google.com", stroke: "stroke-ring-visibility" },
};
