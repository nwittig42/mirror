import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { ChangePasswordForm } from "./change-password-form";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Mirror";

export const metadata: Metadata = {
  title: `Set your password · ${appName}`,
};

/**
 * Reachable two ways: middleware sends anyone still holding a temporary
 * password here, and anyone signed in can visit it to change theirs.
 */
export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const forced = session.user.mustChangePassword;
  // See changePassword() for why a link session is never asked for a current
  // password: it is the forgot-password path.
  const requireCurrent = session.user.channel === "password" && !forced;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-black dark:text-zinc-50">
            {forced ? "Choose your password" : "Change your password"}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {forced
              ? `You're signed in with a temporary password. Pick your own to carry on. At least ${MIN_PASSWORD_LENGTH} characters.`
              : `At least ${MIN_PASSWORD_LENGTH} characters. You'll sign in again with the new one.`}
          </p>
        </div>

        <ChangePasswordForm requireCurrent={requireCurrent} />
      </div>
    </div>
  );
}
