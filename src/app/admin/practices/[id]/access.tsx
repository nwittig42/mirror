import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { practiceMembers, users } from "@/db/schema";
import { issueClientPassword } from "@/app/admin/actions";
import { ClientAccess, type IssueResult } from "./client-access";

/**
 * Returns the issued password to the calling client component rather than
 * redirecting, so the plaintext never enters the URL. Errors come back as data
 * (a thrown server action would surface as an opaque "unexpected error" in
 * production), which is how the operator learns they typed the operator's own
 * address into the customer field.
 */
async function handleIssueClientPassword(
  practiceId: string,
  _previous: IssueResult,
  formData: FormData,
): Promise<IssueResult> {
  "use server";
  const email = formData.get("email");
  if (typeof email !== "string" || !email.trim()) {
    return { error: "Enter the customer's email address." };
  }
  try {
    return await issueClientPassword(practiceId, email.trim());
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create a password." };
  }
}

/** The Access tab: who can sign in for this business, and the form that gives them a password. */
export async function Access({ practiceId }: { practiceId: string }) {
  const memberRows = await getDb().select({
    id: users.id,
    email: users.email,
    passwordHash: users.passwordHash,
    mustChangePassword: users.mustChangePassword,
  })
    .from(practiceMembers)
    .innerJoin(users, eq(practiceMembers.userId, users.id))
    .where(eq(practiceMembers.practiceId, practiceId));

  // The hash itself must not reach the client bundle, so the row is reduced to
  // the one bit the panel actually renders: whether a password exists.
  const members = memberRows.map(m => ({
    id: m.id,
    email: m.email,
    hasPassword: m.passwordHash !== null,
    mustChangePassword: m.mustChangePassword,
  }));

  return <ClientAccess members={members} issue={handleIssueClientPassword.bind(null, practiceId)} />;
}
