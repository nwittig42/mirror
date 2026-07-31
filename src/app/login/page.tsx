import type { Metadata } from "next";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Mirror";

export const metadata: Metadata = {
  title: `Log in — ${appName}`,
  description: `Sign in to ${appName} to see what AI tells your patients.`,
};

async function sendMagicLink(formData: FormData): Promise<void> {
  "use server";
  const email = formData.get("email");
  if (typeof email !== "string" || !email) return;
  // "/app", not "/" — "/" is the public marketing page and would strand a
  // freshly signed-in client on marketing instead of their dashboard.
  await signIn("resend", { email, redirectTo: "/app" });
}

async function signInOperator(formData: FormData): Promise<void> {
  "use server";
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") return;

  try {
    await signIn("credentials", { email, password, redirectTo: "/admin" });
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
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">{appName}</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">See what AI tells your patients.</p>
        </div>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            Sign-in failed. Check your credentials and try again.
          </p>
        )}

        <section className="space-y-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Client sign-in</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            We&apos;ll email you a link to sign in — no password needed.
          </p>
          <form action={sendMagicLink} className="flex flex-col gap-3">
            <label className="sr-only" htmlFor="client-email">
              Email
            </label>
            <input
              id="client-email"
              name="email"
              type="email"
              required
              placeholder="you@practice.com"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              type="submit"
              className="w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Send magic link
            </button>
          </form>
        </section>

        <details className="group rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm font-medium text-black dark:text-zinc-50">
            Operator sign-in
          </summary>
          <form action={signInOperator} className="mt-3 flex flex-col gap-3">
            <label className="sr-only" htmlFor="operator-email">
              Email
            </label>
            <input
              id="operator-email"
              name="email"
              type="email"
              required
              placeholder="operator@example.com"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <label className="sr-only" htmlFor="operator-password">
              Password
            </label>
            <input
              id="operator-password"
              name="password"
              type="password"
              required
              placeholder="Password"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              type="submit"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-black hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
            >
              Sign in
            </button>
          </form>
        </details>
      </div>
    </div>
  );
}
