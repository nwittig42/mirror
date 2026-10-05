/**
 * "View as customer": an operator opening a customer's dashboard sees exactly
 * what the customer sees, under an admin banner, and can't act as them.
 * Operators stay signed in as themselves; nothing here touches the session.
 */

/** Shown on every control that would act for the customer. */
export const ADMIN_READ_ONLY_MESSAGE = "Disabled while viewing as admin — nothing is sent.";

/**
 * Whether the signed-in user is an operator looking at a customer's
 * dashboard. Server actions under /dashboard must refuse to act when true,
 * not just hide the button.
 */
export function isAdminViewer(role: string | null | undefined): boolean {
  return role === "operator";
}
