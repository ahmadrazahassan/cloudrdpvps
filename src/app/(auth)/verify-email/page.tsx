import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResendForm } from "@/components/auth/resend-form";
import { getPendingEmail } from "@/lib/auth/pending-email";
import { maskEmail } from "@/lib/mask-email";

export const metadata: Metadata = { title: "Check your email" };

export default async function VerifyEmailPage() {
  const pending = await getPendingEmail();

  return (
    <AuthShell
      eyebrow="Confirm your email"
      title="Check your inbox."
      lead={
        pending
          ? `We sent a confirmation link to ${maskEmail(pending)}. Open it to activate your account, then sign in.`
          : "Open the confirmation link we emailed you to activate your account, then sign in."
      }
      footer={
        <>
          Already confirmed?{" "}
          <Link href="/login" className="text-link">
            Sign in
          </Link>
        </>
      }
    >
      <p className="mb-6 text-[15px] text-ink-2">Didn&apos;t get it? Check your spam folder, or ask for another.</p>
      <ResendForm knownAddress={Boolean(pending)} />
    </AuthShell>
  );
}
