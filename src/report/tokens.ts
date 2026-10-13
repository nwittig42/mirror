/**
 * Mirror AI Visibility Audit — design tokens.
 * Same values as tokens.css. Use one or the other, not hex literals.
 */
import type { ToolId, SourceType } from '@/report/types';

export const color = {
  ink: '#0F172A',          // headings, numbers
  body: '#1E293B',         // paragraph text
  text2: '#334155',        // secondary text
  muted: '#475569',        // captions
  subtle: '#64748B',       // labels, footers (min for text)
  rule: '#E2E8F0',         // borders, dividers, empty ring track
  track: '#F1F5F9',        // bar/ring background
  panel: '#F8FAFC',        // soft panels
  surface: '#FFFFFF',      // page

  client: '#2563EB',       // "you" in every comparison chart
  clientText: '#1D4ED8',
  clientSoft: '#EFF6FF',
  clientTint: '#DBEAFE',
  competitor: '#CBD5E1',   // everyone else in comparisons
  competitorDark: '#94A3B8',
} as const;

/** Reserved for status only — never reuse for categories. Always pair with an icon or label. */
export const statusColor = {
  good:    { fill: '#16A34A', text: '#15803D', soft: '#F0FDF4', tint: '#DCFCE7' },
  warn:    { fill: '#F59E0B', text: '#B45309', soft: '#FFFBEB', tint: '#FEF3C7', strong: '#D97706' },
  bad:     { fill: '#DC2626', text: '#B91C1C', soft: '#FEF2F2', tint: '#FEE2E2' },
  neutral: { fill: '#94A3B8', text: '#334155', soft: '#F8FAFC', tint: '#F1F5F9' },
} as const;

/** Section eyebrow pills follow the report's story arc. */
export const stageColor = {
  stand:  { bg: '#DBEAFE', fg: '#1D4ED8' }, // Where you stand
  losing: { bg: '#EDE9FE', fg: '#6D28D9' }, // Who's beating you and why
  wrong:  { bg: '#FEE2E2', fg: '#B91C1C' }, // What AI gets wrong
  fix:    { bg: '#DCFCE7', fg: '#15803D' }, // What to fix
  method: { bg: '#F1F5F9', fg: '#334155' },
} as const;

/**
 * AI assistant badges. Two-letter monograms on a colored rounded square —
 * NOT the vendors' logos. Swap in official logo files only if you have the rights.
 */
export const toolMeta: Record<ToolId, { name: string; short: string; color: string }> = {
  chatgpt:    { name: 'ChatGPT',    short: 'Ch', color: '#0F766E' },
  claude:     { name: 'Claude',     short: 'Cl', color: '#D97757' },
  gemini:     { name: 'Gemini',     short: 'Ge', color: '#4F46E5' },
  grok:       { name: 'Grok',       short: 'Gr', color: '#111827' },
  perplexity: { name: 'Perplexity', short: 'Pe', color: '#7C3AED' },
  // A non-breaking space, so the name stays on one line in a narrow card.
  google:     { name: 'Google\u00A0AI', short: 'Go', color: '#1D4ED8' },
};

/** Source-type donut. Order and colors validated for color-blind separation. */
export const sourceColor: Record<SourceType, string> = {
  articles: '#7C3AED',
  reviews_directories: '#0D9488',
  reddit_social: '#E8590C',
  own_website: '#2563EB',
  google: '#DB2777',
  reference: '#94A3B8',
};
export const sourceLabel: Record<SourceType, string> = {
  articles: 'Articles',
  reviews_directories: 'Reviews and directories',
  reddit_social: 'Reddit and social',
  own_website: 'Your website',
  google: 'Google',
  reference: 'Reference',
};

/** Tone donut. */
export const toneColor = {
  recommended: statusColor.good.fill,
  justListed: color.competitorDark,
  mixed: statusColor.warn.fill,
  warnedAgainst: statusColor.bad.fill,
} as const;

export const font = {
  display: "'Newsreader', Georgia, serif",          // h1/h2, verdicts, quotes (italic)
  body: "'Hanken Grotesk', system-ui, sans-serif",   // everything else; tabular-nums on
  googleFontsHref:
    'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap',
} as const;

export const type = {
  coverTitle: 84, h1: 34, h2: 28, verdict: 29, takeaway: 16, body: 13.5,
  small: 12, label: 11, // labels: 700 weight, 0.08em tracking, uppercase
} as const;

export const radius = { chip: 99, sm: 8, md: 12, lg: 16, xl: 20 } as const;

/** US Letter at 96 px/in. Each report page is one fixed-size sheet. */
export const page = {
  width: 816, height: 1056,
  padding: { top: 44, right: 64, bottom: 36, left: 64 },
  coverPadding: { top: 56, right: 64, bottom: 0, left: 64 },
} as const;
