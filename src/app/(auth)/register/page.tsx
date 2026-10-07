import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/redirect";

export const metadata: Metadata = { title: "Create your account" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function RegisterPage({ searchParams }: Props) {
  // Where to go after signing up (e.g. back to the plan they were configuring). Validated as a same-site path.
  const rawNext = first((await searchParams).next);
  const next = rawNext ? safeNext(rawNext) : undefined;
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <AuthShell
      eyebrow="Create account"
      title="Create your account."
      lead="It takes a minute. We'll email you a link to confirm your address before you can order."
      footer={
        <>
          Already have an account?{" "}
          <Link href={loginHref} className="text-link">
            Sign in
          </Link>
        </>
      }
    >
      {!isSupabaseConfigured ? (
        <p className="form-note mb-5" data-tone="error">
          Accounts aren&apos;t connected in this environment yet. Add the Supabase keys to <code>.env.local</code>.
        </p>
      ) : null}
      <RegisterForm next={next} />
    </AuthShell>
  );
}
