import { escapeHtml } from "@/lib/html";

/**
 * The one look every Mirror email shares: ivory page, white card, near-black
 * ink, one gold accent. Pure string building, no I/O.
 *
 * Built for mail clients, not browsers: tables for layout, every style
 * inline, system fonts only, no images, no flexbox or grid. Spacing lives on
 * table cells because Outlook ignores margins on most other elements.
 *
 * Arguments named `html` are inserted as they are, so the caller must have
 * escaped anything dynamic with escapeHtml first. `emailButton` and
 * `emailLink` take plain text and a plain URL and escape both themselves.
 */

export const EMAIL_COLORS = {
  page: "#f7f5f0",
  card: "#ffffff",
  rule: "#ded8cd",
  ink: "#1a1a18",
  secondary: "#46443f",
  caption: "#78746c",
  gold: "#a8763e",
  bad: "#a33a2a",
  badBg: "#f4e1dc",
  good: "#4f6b4a",
  goodBg: "#e2e9dd",
} as const;

const C = EMAIL_COLORS;
const SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,serif";
const WIDTH = 600;

type TextTone = "ink" | "secondary" | "caption" | "bad" | "good" | "gold";

/** Small uppercase grey label that sits above a section. */
export function emailLabel(html: string, tone: TextTone = "caption"): string {
  return `<div style="font-family:${SANS};font-size:11px;line-height:22px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${C[tone]};">${html}</div>`;
}

/** A paragraph of body text. */
export function emailText(html: string, tone: TextTone = "ink", size: 13 | 14 | 16 = 16): string {
  const lineHeight = size === 16 ? 25 : size === 14 ? 22 : 20;
  return `<div style="font-family:${SANS};font-size:${size}px;line-height:${lineHeight}px;color:${C[tone]};">${html}</div>`;
}

/** A score: one large semi-bold number, with an optional short note beside it. */
export function emailNumber(html: string, asideHtml = "", asideTone: TextTone = "secondary"): string {
  return (
    `<div style="font-family:${SANS};color:${C.ink};">` +
    `<span style="font-size:44px;line-height:50px;font-weight:600;letter-spacing:-0.02em;">${html}</span>` +
    (asideHtml ? `<span style="font-size:15px;line-height:50px;font-weight:600;color:${C[asideTone]};">&nbsp;&nbsp;${asideHtml}</span>` : "") +
    `</div>`
  );
}

/** Someone else's words, set off with a gold rule on the left. */
export function emailQuote(html: string, captionHtml = ""): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td style="border-left:3px solid ${C.gold};padding:2px 0 2px 16px;">` +
    (captionHtml ? `<div style="font-family:${SANS};font-size:13px;line-height:20px;color:${C.caption};padding-bottom:4px;">${captionHtml}</div>` : "") +
    `<div style="font-family:${SANS};font-size:16px;line-height:25px;font-style:italic;color:${C.ink};">${html}</div>` +
    `</td></tr></table>`
  );
}

/** A tinted box: red for something AI got wrong, green for good news, ivory for a plain aside. */
export function emailNote(html: string, tone: "bad" | "good" | "plain" = "plain"): string {
  const bg = tone === "bad" ? C.badBg : tone === "good" ? C.goodBg : C.page;
  const color = tone === "bad" ? C.bad : tone === "good" ? C.good : C.ink;
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td bgcolor="${bg}" style="background:${bg};border-radius:8px;padding:14px 16px;font-family:${SANS};font-size:15px;line-height:23px;color:${color};">${html}</td>` +
    `</tr></table>`
  );
}

/** The primary button. One per email. Takes plain text and a plain URL. */
export function emailButton(href: string, label: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td bgcolor="${C.gold}" style="background:${C.gold};border-radius:8px;padding:13px 24px;">` +
    `<a href="${escapeHtml(href)}" style="font-family:${SANS};font-size:16px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;display:inline-block;">${escapeHtml(label)}</a>` +
    `</td></tr></table>`
  );
}

/** A secondary text link in the accent colour. Takes plain text and a plain URL. */
export function emailLink(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="font-family:${SANS};font-size:15px;line-height:22px;font-weight:600;color:${C.gold};text-decoration:underline;">${escapeHtml(label)}</a>`;
}

/** A thin horizontal rule. */
export function emailRule(): string {
  return `<div style="border-top:1px solid ${C.rule};font-size:0;line-height:0;height:0;">&nbsp;</div>`;
}

export interface EmailShellArgs {
  /** Small uppercase line under the wordmark, already escaped. */
  eyebrowHtml?: string;
  /** The heading, already escaped. */
  titleHtml?: string;
  /** One line under the heading, already escaped. */
  introHtml?: string;
  /** The content blocks in order, each already-built HTML. Empty strings are skipped. */
  blocks: string[];
  /** Small centred line under the card, already escaped. */
  footerHtml?: string;
  /** The wordmark. Plain text, escaped here. */
  brand?: string;
}

/** Wraps content blocks in the shared page, card, wordmark and footer. */
export function emailShell(args: EmailShellArgs): string {
  const blocks = args.blocks.filter(Boolean);
  const cell = (html: string, last: boolean) =>
    `<tr><td style="padding:0 0 ${last ? 0 : 22}px;">${html}</td></tr>`;

  const head =
    `<tr><td style="padding:0 0 18px;font-family:${SERIF};font-size:24px;line-height:28px;color:${C.ink};">${escapeHtml(args.brand ?? "Mirror")}</td></tr>` +
    `<tr><td style="padding:0 0 22px;">${emailRule()}</td></tr>` +
    (args.eyebrowHtml ? `<tr><td style="padding:0 0 4px;">${emailLabel(args.eyebrowHtml)}</td></tr>` : "") +
    (args.titleHtml
      ? `<tr><td style="padding:0 0 ${args.introHtml ? 6 : 22}px;font-family:${SANS};font-size:22px;line-height:28px;font-weight:600;color:${C.ink};">${args.titleHtml}</td></tr>`
      : "") +
    (args.introHtml ? `<tr><td style="padding:0 0 22px;">${emailText(args.introHtml, "secondary", 14)}</td></tr>` : "");

  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>` +
    `<body style="margin:0;padding:0;background:${C.page};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">` +
    `<tr><td align="center" style="padding:32px 16px;">` +
    `<!--[if mso]><table role="presentation" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:${WIDTH}px;">` +
    `<tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.rule};border-radius:12px;padding:32px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    head +
    blocks.map((b, i) => cell(b, i === blocks.length - 1)).join("") +
    `</table></td></tr>` +
    (args.footerHtml
      ? `<tr><td align="center" style="padding:16px 8px 0;font-family:${SANS};font-size:12px;line-height:18px;color:${C.caption};">${args.footerHtml}</td></tr>`
      : "") +
    `</table>` +
    `<!--[if mso]></td></tr></table><![endif]-->` +
    `</td></tr></table></body></html>`
  );
}
