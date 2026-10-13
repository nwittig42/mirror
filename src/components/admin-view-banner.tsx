"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface PracticeLink { id: string; name: string; slug: string }

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const BUTTON = `rounded-full px-4 py-1.5 text-[13px] font-semibold ${FOCUS}`;

/**
 * The strip an operator sees on top of every customer dashboard page. Only
 * ever rendered for operators (see the dashboard layout); a customer's page
 * gets no markup from it at all.
 */
export function AdminViewBanner({ current, practices }: { current: PracticeLink; practices: PracticeLink[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);

  // Close the switcher on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = practices.filter(p => !q || p.name.toLowerCase().includes(q) || p.slug.includes(q));

  return (
    <div className="sticky top-0 z-50 border-b border-gold bg-gold-soft text-ink print:hidden">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-[14px] sm:px-6">
        <p>
          <strong>Viewing {current.name} as admin.</strong>{" "}
          The customer can&apos;t see this banner. Read-only.
        </p>
        <div ref={box} className="relative flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
            className={`${BUTTON} border border-gold bg-paper text-ink hover:bg-ivory`}>
            Switch customer ▾
          </button>
          <Link href={`/admin/practices/${current.id}/overview`}
            className={`${BUTTON} bg-ink text-ivory hover:bg-ink-raised`}>
            ← Back to admin page
          </Link>
          {open && (
            <div className="absolute right-0 top-full mt-2 w-[260px] rounded-2xl border border-line bg-paper p-2 text-ink shadow-lg">
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a customer"
                className="mb-1 w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[13px] text-ink outline-none placeholder:text-muted focus:border-gold" />
              <div className="max-h-72 overflow-y-auto">
                {matches.map(p => (
                  <Link key={p.id} href={`/dashboard/${p.slug}`} onClick={() => setOpen(false)}
                    className="flex items-baseline justify-between gap-2 rounded-lg px-2.5 py-2 text-[13px] hover:bg-bone">
                    <span className={p.id === current.id ? "font-semibold" : ""}>{p.name}</span>
                    <span className="text-[12px] text-muted">{p.slug}</span>
                  </Link>
                ))}
                {matches.length === 0 && <p className="px-2.5 py-2 text-[13px] text-muted">No match.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
