"use client";

import { useState, type ComponentProps } from "react";

/**
 * A password box with an eye button at its right edge that shows what has
 * been typed, and hides it again on a second click. Takes everything a plain
 * input takes except `type`.
 */
export function PasswordInput({ className = "", ...rest }: Omit<ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...rest} type={shown ? "text" : "password"} className={`${className} w-full pr-12`} />
      <button
        type="button"
        onClick={() => setShown(s => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {/* A line through the eye while the password is showing: clicking hides it. */}
          {shown && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}
