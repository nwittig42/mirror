import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { buttonClass, Note, type Tone } from "@/components/ui";

/**
 * Admin-only pieces on top of the shared kit in src/components/ui.tsx: one
 * style for every form control, small buttons for table rows, the underlined
 * tab row, and a few labels. Colours come from the theme (bg-paper, text-ink,
 * border-line and so on); nothing here writes a colour value.
 */

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

/** The column every admin page and the admin header share. */
export const ADMIN_WIDTH = "mx-auto max-w-6xl px-4 sm:px-6";

// ------------------------------------------------------------------ forms

/** One look for inputs, selects and textareas. */
export const fieldClass =
  "min-w-0 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] text-ink outline-none placeholder:text-muted focus:border-gold disabled:opacity-50";

export function TextInput({ className = "", ...rest }: ComponentProps<"input">) {
  return <input {...rest} className={`${fieldClass} ${className}`} />;
}

export function Select({ className = "", ...rest }: ComponentProps<"select">) {
  return <select {...rest} className={`${fieldClass} ${className}`} />;
}

export function TextArea({ className = "", ...rest }: ComponentProps<"textarea">) {
  return <textarea {...rest} className={`${fieldClass} ${className}`} />;
}

type Variant = "primary" | "gold" | "outline";
type Size = "md" | "sm";

const SMALL: Record<Variant, string> = {
  primary: "bg-ink text-ivory hover:bg-ink-raised",
  gold: "bg-gold text-paper hover:brightness-110",
  outline: "border border-line bg-paper text-ink hover:border-ink",
};

/** Button look for buttons and links. `sm` is for table rows and card corners. */
export function actionClass(variant: Variant = "primary", size: Size = "md"): string {
  return size === "md"
    ? `${buttonClass(variant)} disabled:opacity-50`
    : `inline-flex items-center justify-center whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold disabled:opacity-50 ${SMALL[variant]} ${FOCUS}`;
}

/** A submit button unless told otherwise. */
export function Button({ variant = "primary", size = "md", className = "", type = "submit", ...rest }:
  ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button {...rest} type={type} className={`${actionClass(variant, size)} ${className}`} />;
}

/** A quiet text button for small actions like Remove, Hide and Reopen. */
export function TextButton({ className = "", type = "submit", ...rest }: ComponentProps<"button">) {
  return (
    <button {...rest} type={type}
      className={`text-[13px] font-medium text-muted underline-offset-4 hover:text-ink hover:underline ${FOCUS} ${className}`} />
  );
}

// ------------------------------------------------------------------ links

export const linkClass = `font-medium text-ink underline decoration-line underline-offset-4 hover:text-gold hover:decoration-gold ${FOCUS}`;

export function PrimaryLink({ href, children, size = "sm" }: { href: string; children: ReactNode; size?: Size }) {
  return <Link href={href} className={actionClass("primary", size)}>{children}</Link>;
}

export function SecondaryLink({ href, children, size = "sm" }: { href: string; children: ReactNode; size?: Size }) {
  return <Link href={href} className={actionClass("outline", size)}>{children}</Link>;
}

/** "← All customers": back to the main admin page. */
export function BackToAdmin() {
  return (
    <Link href="/admin" className={`text-[14px] font-medium text-muted hover:text-gold ${FOCUS}`}>
      ← All customers
    </Link>
  );
}

// ------------------------------------------------------------------- tabs

/** One underlined tab: gold line under the current one. Shared with the admin top bar. */
export function tabClass(active: boolean): string {
  return `-mb-px whitespace-nowrap border-b-2 pb-3 text-[15px] font-semibold ${FOCUS} ${
    active ? "border-gold text-ink" : "border-transparent text-muted hover:text-ink"}`;
}

export const TAB_ROW = "-mx-1 flex gap-6 overflow-x-auto border-b border-line px-1";

export function Tabs({ label, items, current }: {
  label: string;
  current: string;
  items: { key: string; label: string; href: string; count?: number }[];
}) {
  return (
    <nav className={TAB_ROW} aria-label={label}>
      {items.map(t => (
        <Link key={t.key} href={t.href} aria-current={t.key === current ? "page" : undefined} className={tabClass(t.key === current)}>
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-[13px] font-medium text-muted">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

// ------------------------------------------------------------ small pieces

const NOTICE: Record<Tone, string> = {
  neutral: "bg-bone text-ink-soft",
  gold: "bg-gold-soft text-ink",
  flag: "bg-flag-soft text-flag",
  ok: "bg-ok-soft text-ok",
};

/** A coloured line that reports what just happened or what needs a look. */
export function Notice({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <p className={`rounded-xl px-4 py-3 text-[14px] font-medium leading-relaxed ${NOTICE[tone]} ${className}`}>{children}</p>;
}

/** What a list says when it has nothing in it. */
export function Empty({ children }: { children: ReactNode }) {
  return <Note>{children}</Note>;
}

/** A page title with one line under it. */
export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-[34px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
      {children && <Note className="mt-2 max-w-2xl">{children}</Note>}
    </div>
  );
}

/** Table cells: one header style, one row style. */
export const TH = "py-2 pr-4 text-left text-[13px] font-semibold text-muted";
export const TD = "py-2.5 pr-4 align-top text-[15px]";
export const ROW = "border-b border-line last:border-b-0";

export const SCAN_STATUS: Record<string, { label: string; dot: string }> = {
  complete: { label: "Complete", dot: "bg-ok" },
  blocked: { label: "Blocked", dot: "bg-gold" },
  failed: { label: "Failed", dot: "bg-flag" },
  running: { label: "Running", dot: "bg-muted" },
};

export function formatDate(d: Date | null | undefined): string {
  if (!d) return "Never";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
