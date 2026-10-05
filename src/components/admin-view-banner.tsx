"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface PracticeLink { id: string; name: string; slug: string }

const AMBER = { bg: "oklch(0.9 0.1 85)", border: "oklch(0.78 0.1 80)" };

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
    <div className="sticky top-0 z-50 print:hidden" style={{ background: AMBER.bg, borderBottom: `1px solid ${AMBER.border}`, color: "#1c1917" }}>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm">
        <p>
          <strong>Viewing {current.name} as admin.</strong>{" "}
          The customer can&apos;t see this banner. Read-only.
        </p>
        <div ref={box} className="relative flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
            className="rounded-md bg-white px-3 py-1.5 text-[13px] font-medium" style={{ border: `1px solid ${AMBER.border}` }}>
            Switch customer ▾
          </button>
          <Link href={`/admin/practices/${current.id}/overview`}
            className="rounded-md px-3 py-1.5 text-[13px] font-medium text-white" style={{ background: "#1c1917" }}>
            ← Back to admin page
          </Link>
          {open && (
            <div className="absolute right-0 top-full mt-2 w-[260px] rounded-[10px] bg-white p-2 text-black"
              style={{ boxShadow: "0 10px 30px rgba(0,0,0,.12)" }}>
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a customer"
                className="mb-1 w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-[13px] outline-none focus:border-zinc-500" />
              <div className="max-h-72 overflow-y-auto">
                {matches.map(p => (
                  <Link key={p.id} href={`/dashboard/${p.slug}`} onClick={() => setOpen(false)}
                    className="flex items-baseline justify-between gap-2 rounded-md px-2.5 py-2 text-[13px] hover:bg-zinc-100">
                    <span className={p.id === current.id ? "font-semibold" : ""}>{p.name}</span>
                    <span className="text-xs text-zinc-500">{p.slug}</span>
                  </Link>
                ))}
                {matches.length === 0 && <p className="px-2.5 py-2 text-[13px] text-zinc-500">No match.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
