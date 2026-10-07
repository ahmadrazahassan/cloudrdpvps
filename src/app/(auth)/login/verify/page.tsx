import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { MfaPanel } from "@/components/auth/mfa-panel";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { needsSecondFactor } from "@/lib/auth/mfa";
import { getSessionUser } from "@/lib/auth/session";
import { loginUrl, safeNext } from "@/lib/redirect";

export const metadata: Metadata = { title: "Two-step verification" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * The second screen of signing in, for accounts that have an authenticator app. It does NOT use `requireUser` (that
 * would send this very visitor back here); it only needs a signed-in session. Anyone who doesn't need the step —
 * signed out, no authenticator, or already verified — is moved on.
 */
export default async function VerifyPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = safeNext(first(sp.next));
  const user = await getSessionUser();
  if (!user) redirect(loginUrl(next));
  if (!(await needsSecondFactor())) redirect(next);

  return (
    <AuthShell
      eyebrow="Two-step verification"
      title="Enter your code."
      lead="Open your authenticator app and enter the 6-digit code for your account to finish signing in."
      footer={
        <>
          Signed in as <span className="font-semibold text-ink">{user.email}</span>. Not you? <SignOutLink />
        </>
      }
    >
      <MfaPanel enrolled next={next} />
    </AuthShell>
  );
}
