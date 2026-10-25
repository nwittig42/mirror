import type { Metadata } from "next";
import Link from "next/link";
import "../landing.css";
import { getDb } from "@/db";
import { LandingFooter, LandingNav } from "@/components/landing/chrome";
import { inviteEmail } from "@/services/account-invites";
import { WelcomeForm } from "./welcome-form";

/**
 * Where the report email's "Set up your account" link lands (/welcome?token=).
 * Their email is the username, shown from the invite when the link is still
 * good. A used, expired or unknown link shows no email, and submitting says
 * which it was.
 */

export const metadata: Metadata = {
  title: "Set up your account · Mirror",
  robots: { index: false },
};

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token: raw } = await searchParams;
  const token = typeof raw === "string" ? raw.slice(0, 200) : "";
  const email = token ? await inviteEmail(getDb(), token) : null;

  return (
    <div className="mk mk-audit-page">
      <LandingNav />

      <main style={{ flex: 1 }}>
        <section className="mk-section">
          <div className="mk-inner mk-welcome">
            <div className="mk-form-card">
              <span className="mk-eyebrow">Your audit</span>
              <h1 className="mk-display mk-h3" style={{ marginTop: 14 }}>Set up your Mirror account</h1>
              {email && (
                <p className="mk-body" style={{ marginTop: 14 }}>
                  Your email: <strong>{email}</strong>
                </p>
              )}
              <WelcomeForm token={token} />
              <p className="mk-field-hint" style={{ marginTop: 14 }}>
                Already have an account? <Link href="/login">Log in</Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
