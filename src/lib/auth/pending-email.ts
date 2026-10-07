import "server-only";
import { cookies } from "next/headers";

const NAME = "crv_pending_email";

/**
 * The address a confirmation email was just sent to, kept in a short-lived
 * httpOnly cookie so the "check your inbox" page can offer a resend without the
 * email ever appearing in a URL, browser history or analytics.
 */
export async function setPendingEmail(email: string) {
  (await cookies()).set(NAME, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 60,
  });
}

export async function getPendingEmail(): Promise<string | null> {
  return (await cookies()).get(NAME)?.value ?? null;
}

export async function clearPendingEmail() {
  (await cookies()).delete(NAME);
}
