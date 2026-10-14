import Link from "next/link";
import type { Metadata } from "next";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { PasswordInput } from "@/components/password-input";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Mirror";

const inputClass =
  "w-full rounded-xl border border-line bg-paper px-4 py-3 text-[15px] text-ink outline-none placeholder:text-muted focus:border-gold";

export const metadata: Metadata = {
  title: `Log in · ${appName}`,
  description: `Sign in to ${appName} to see what AI tells your customers.`,
};

async function sendMagicLink(formData: FormData): Promise<void> {
  "use server";
  const email = formData.get("email");
  if (typeof email !== "string" || !email) return;
  // "/app", not "/", because "/" is the public marketing page and would strand a
  // freshly signed-in client on marketing instead of their dashboard.
  await signIn("resend", { email, redirectTo: "/app" });
}

async function signInWithPassword(formData: FormData): Promise<void> {
  "use server";
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") return;

  try {
    // "/app", not "/admin": clients sign in here too now, and /app is the page
    // that routes by role. Sending everyone to /admin would 404 every client.
    // Middleware intercepts anyone still on a temporary password and sends
    // them to /change-password before this destination is ever rendered.
    await signIn("credentials", { email, password, redirectTo: "/app" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=CredentialsSignin");
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; changed?: string }>;
}) {
  const { error, changed } = await searchParams;

  return (
    <div className="app flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-8">
        <Link href="/" className="inline-block text-[14px] font-medium text-muted hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">← Back to Mirror</Link>
        <div className="text-center">
          <h1 className="display text-[40px] leading-none text-ink">{appName}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">Get recommended by AI. Fix what it gets wrong.</p>
        </div>

        {changed && !error && (
          <p className="rounded-xl bg-ok-soft px-4 py-3 text-[14px] font-medium text-ok">
            Password saved. Sign in with your new one.
          </p>
        )}

        {error && (
          <p className="rounded-xl bg-flag-soft px-4 py-3 text-[14px] font-medium text-flag">
            Sign-in failed. Check your credentials and try again.
          </p>
        )}

        <section className="space-y-4 rounded-[20px] border border-line bg-paper p-6">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">Sign in</h2>
          <form action={signInWithPassword} className="flex flex-col gap-3">
            <label className="sr-only" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@yourbusiness.com"
              className={inputClass}
            />
            <label className="sr-only" htmlFor="password">
              Password
            </label>
            <PasswordInput
              id="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="Password"
              className={inputClass}
            />
            <button
              type="submit"
              className="w-full rounded-full bg-ink px-5 py-3 text-[15px] font-semibold text-ivory hover:bg-ink-raised"
            >
              Sign in
            </button>
          </form>
        </section>

        <details className="group rounded-[20px] border border-line bg-paper p-6">
          <summary className="cursor-pointer text-[15px] font-semibold text-ink">
            Forgot your password?
          </summary>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            We&apos;ll email you a link that signs you in. You can set a new password once you&apos;re in.
          </p>
          <form action={sendMagicLink} className="mt-3 flex flex-col gap-3">
            <label className="sr-only" htmlFor="link-email">
              Email
            </label>
            <input
              id="link-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@yourbusiness.com"
              className={inputClass}
            />
            <button
              type="submit"
              className="w-full rounded-full border border-ink px-5 py-3 text-[15px] font-semibold text-ink hover:bg-bone"
            >
              Email me a link
            </button>
          </form>
        </details>
      </div>
    </div>
  );
}
