/**
 * Mirror reports: design tokens.
 *
 * The same palette as the website and the signed-in app (see the @theme block
 * in src/app/globals.css). Gold is "you" and the thing to notice, red is only
 * for something wrong, green only for something right, everything else is
 * ink on white with warm greys. Use these, not hex literals, in a page.
 */
import type { ToolId, SourceType } from '@/report/types';

/** The website palette, by its own names. */
export const palette = {
  ink: '#1a1a18',
  inkSoft: '#46443f',
  inkRaised: '#2b2824',
  muted: '#78746c',
  ivory: '#f7f5f0',
  bone: '#ede8df',
  paper: '#ffffff',
  line: '#ded8cd',
  gold: '#a8763e',
  goldSoft: '#e9dcc8',
  flag: '#a33a2a',
  flagSoft: '#f4e1dc',
  ok: '#4f6b4a',
  okSoft: '#e2e9dd',
  blush: '#f2e6df',
} as const;

export const color = {
  ink: palette.ink,          // headings, numbers
  body: palette.inkSoft,     // paragraph text
  text2: palette.inkSoft,    // secondary text
  muted: palette.muted,      // captions
  subtle: palette.muted,     // labels, footers
  rule: palette.line,        // borders, dividers
  track: palette.bone,       // bar and ring background
  panel: palette.ivory,      // soft panels
  surface: palette.paper,    // page

  client: palette.gold,      // "you" in every comparison chart
  clientText: palette.gold,
  clientSoft: palette.ivory,
  clientTint: palette.goldSoft,
  competitor: palette.line,  // everyone else in comparisons
  competitorDark: palette.muted,
} as const;

/** Reserved for status only. Always paired with an icon or a word, so it still reads in black and white. */
export const statusColor = {
  good:    { fill: palette.ok,    text: palette.ok,      soft: palette.okSoft,   tint: palette.okSoft },
  warn:    { fill: palette.gold,  text: palette.gold,    soft: palette.goldSoft, tint: palette.goldSoft, strong: palette.gold },
  bad:     { fill: palette.flag,  text: palette.flag,    soft: palette.flagSoft, tint: palette.flagSoft },
  neutral: { fill: palette.muted, text: palette.inkSoft, soft: palette.ivory,    tint: palette.bone },
} as const;

/**
 * AI assistant badges. Two-letter monograms on a rounded square, NOT the
 * vendors' logos. The colours are quiet earth tones that sit with the palette.
 */
export const toolMeta: Record<ToolId, { name: string; short: string; color: string }> = {
  chatgpt:    { name: 'ChatGPT',    short: 'Ch', color: '#5d7a72' },
  claude:     { name: 'Claude',     short: 'Cl', color: '#b0705a' },
  gemini:     { name: 'Gemini',     short: 'Ge', color: '#6b6f96' },
  grok:       { name: 'Grok',       short: 'Gr', color: palette.inkRaised },
  perplexity: { name: 'Perplexity', short: 'Pe', color: '#86688f' },
  // A non-breaking space, so the name stays on one line in a narrow card.
  google:     { name: 'Google AI', short: 'Go', color: '#5f7f9e' },
};

/** Source types. Your own website is gold; the rest are quiet. */
export const sourceColor: Record<SourceType, string> = {
  articles: '#86688f',
  reviews_directories: '#5d7a72',
  reddit_social: '#b0705a',
  own_website: palette.gold,
  google: '#5f7f9e',
  reference: palette.muted,
};
export const sourceLabel: Record<SourceType, string> = {
  articles: 'Articles',
  reviews_directories: 'Reviews and directories',
  reddit_social: 'Reddit and social',
  own_website: 'Your website',
  google: 'Google',
  reference: 'Reference',
};

/** How AI talks about you. */
export const toneColor = {
  recommended: statusColor.good.fill,
  justListed: color.competitorDark,
  mixed: statusColor.warn.fill,
  warnedAgainst: statusColor.bad.fill,
} as const;

export const font = {
  /** The "Mirror" wordmark only. */
  display: "var(--font-display, 'Playfair Display'), 'Playfair Display', Georgia, serif",
  /** Everything else. */
  body: "var(--font-body, 'Inter'), 'Inter', system-ui, sans-serif",
  googleFontsHref:
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;500&display=swap',
} as const;

export const type = {
  title: 40, h1: 28, verdict: 21, takeaway: 15, body: 13.5,
  small: 12, label: 11, // labels: 600 weight, 0.12em tracking, uppercase, muted
} as const;

export const radius = { chip: 99, sm: 8, md: 12, lg: 16, xl: 20 } as const;

/** US Letter at 96 px/in. Each report page is one fixed-size sheet. */
export const page = {
  width: 816, height: 1056,
  padding: { top: 44, right: 64, bottom: 36, left: 64 },
} as const;
