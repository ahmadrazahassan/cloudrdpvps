import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetForm } from "@/components/auth/reset-form";
import { getSessionUser } from "@/lib/auth/session";
import { ERROR_MESSAGES } from "@/lib/errors";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // The emailed link signs the person in (see /auth/confirm); without that session there is nothing to reset.
  const user = await getSessionUser();

  return (
    <AuthShell
      eyebrow="Password"
      title="Choose a new password."
      lead={user ? "Pick something you don't use anywhere else." : undefined}
      footer={
        <Link href="/login" className="text-link">
          Back to sign in
        </Link>
      }
    >
      {user ? (
        <ResetForm />
      ) : (
        <div className="space-y-4">
          <p role="alert" className="form-note" data-tone="error">
            {ERROR_MESSAGES.LINK_INVALID}
          </p>
          <p>
            <Link href="/forgot-password" className="text-link">
              Request a new reset link
            </Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
