import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
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

  // Never echo the reason: an expired, used or forged link all look the same to the visitor.
  redirect(ok ? next : "/login?error=link");
}
