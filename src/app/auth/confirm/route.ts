import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { drainSoon, queueWelcomeEmail } from "@/lib/email/queue";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for the links in Supabase Auth emails (confirm signup, reset password, change email).
 *
 *   /auth/confirm?token_hash=…&type=recovery&next=/reset-password   (recommended: works on any device)
 *   /auth/confirm?code=…&next=/dashboard                            (PKCE: same browser that requested it)
 *
 * On success the session cookie is set here and the visitor continues to `next` — a same-site path only.
 * Confirming a new account also queues its welcome email (once; see queueWelcomeEmail).
 */
const TYPES: ReadonlySet<string> = new Set(["signup", "email", "recovery", "invite", "magiclink", "email_change"]);

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) redirect("/login?error=link");

  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"), "/dashboard");
  const supabase = await createClient();

  let ok = false;
  if (tokenHash && type && TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (ok) {
    // A signup link says so itself. A PKCE `code` doesn't, so treat "confirmed within the last few minutes" as a
    // new account (a password-reset link for an old account never matches, and the welcome is sent only once anyway).
    const signup = type === "signup" || type === "email";
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      const confirmedAt = user?.email_confirmed_at ? Date.parse(user.email_confirmed_at) : NaN;
      const justConfirmed = Number.isFinite(confirmedAt) && Date.now() - confirmedAt < 5 * 60_000;
      if (user?.email && (signup || (code && justConfirmed))) {
        const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
        if (await queueWelcomeEmail({ id: user.id, email: user.email, name })) drainSoon();
      }
    } catch (error) {
      console.error("[auth/confirm] welcome email", error instanceof Error ? error.message : error);
    }
  }

  // Never echo the reason: an expired, used or forged link all look the same to the visitor.
  redirect(ok ? next : "/login?error=link");
}
