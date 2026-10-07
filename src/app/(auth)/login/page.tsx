import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured } from "@/lib/env";
import { ERROR_MESSAGES } from "@/lib/errors";
import { safeNext } from "@/lib/redirect";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const rawNext = first(sp.next);
  const next = rawNext ? safeNext(rawNext) : undefined;

  const notice =
    first(sp.reason) === "session"
      ? "Your session has ended. Please sign in again."
      : first(sp.error) === "link"
        ? ERROR_MESSAGES.LINK_INVALID
        : first(sp.notice) === "confirmed"
          ? "Email confirmed. Sign in to continue."
          : null;

  return (
    <AuthShell
      eyebrow="Sign in"
      title="Welcome back."
      lead="Sign in to manage your servers, orders and support tickets."
      footer={
        <>
          New here?{" "}
          <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="text-link">
            Create an account
          </Link>
        </>
      }
    >
      {!isSupabaseConfigured ? (
        <p className="form-note mb-5" data-tone="error">
          Accounts aren&apos;t connected in this environment yet. Add the Supabase keys to <code>.env.local</code>.
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="form-note mb-5">
          {notice}
        </p>
      ) : null}
      <LoginForm next={next} />
    </AuthShell>
  );
}
