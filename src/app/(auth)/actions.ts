"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { formAction, action } from "@/lib/action";
import { fromAuthError } from "@/lib/auth/errors";
import { clearPendingEmail, getPendingEmail, setPendingEmail } from "@/lib/auth/pending-email";
import { publicEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { safeNext, verifyUrl } from "@/lib/redirect";
import { checkbox, email, fullName, newPassword } from "@/lib/validation";

/**
 * Sign-in, registration and password recovery. All of these talk to Supabase Auth through the
 * per-request server client, so the session cookie is set on the response. Responses are
 * deliberately uniform ("Incorrect email or password", "If that address has an account…") so the
 * forms can't be used to discover who is registered.
 */

const confirmUrl = (next: string) => `${publicEnv.siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`;

/** Second throttle keyed by the email itself, so one account can't be hammered from many IPs. */
async function limitByEmail(name: string, address: string, limit: number, window: "15 m" | "1 h") {
  const r = await rateLimit({ name: `${name}-email`, id: address, limit, window });
  if (!r.ok) throw new AppError("RATE_LIMITED");
}

// ---------------------------------------------------------------------------
export const login = formAction({
  name: "login",
  auth: "public",
  captcha: true,
  rateLimit: { limit: 10, window: "15 m" },
  schema: z.object({
    email,
    password: z.string().min(1, "Enter your password.").max(256),
    next: z.string().optional(),
  }),
  async handler({ email: address, password, next }, { supabase }) {
    await limitByEmail("login", address, 8, "15 m");

    const { error } = await supabase.auth.signInWithPassword({ email: address, password });
    if (error) {
      const mapped = fromAuthError(error);
      // Let them resend the confirmation from the next screen.
      if (mapped.code === "EMAIL_NOT_CONFIRMED") await setPendingEmail(address);
      throw mapped;
    }
    // A password alone isn't enough once an authenticator is set up: ask for the code before anything opens.
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal.data?.nextLevel === "aal2" && aal.data.currentLevel !== "aal2") redirect(verifyUrl(safeNext(next)));
    redirect(safeNext(next));
  },
});

// ---------------------------------------------------------------------------
export const register = formAction({
  name: "register",
  auth: "public",
  captcha: true,
  rateLimit: { limit: 5, window: "1 h" },
  schema: z.object({
    fullName,
    email,
    password: newPassword,
    terms: checkbox.refine((v) => v, "You need to accept the Terms and Privacy Policy."),
    next: z.string().optional(),
    /** "1" when the form sits inside another page (the order page): stay there and say "check your inbox" instead of going to /verify-email. */
    inline: z.string().optional(),
  }),
  async handler({ fullName: name, email: address, password, next, inline }, { supabase }) {
    // Where they were headed before signing up (e.g. a plan they were configuring); same-site paths only.
    const destination = safeNext(next);
    const { data, error } = await supabase.auth.signUp({
      email: address,
      password,
      options: { data: { full_name: name }, emailRedirectTo: confirmUrl(destination) },
    });
    if (error) throw fromAuthError(error);

    // "Confirm email" is off in this Supabase project: the user is already signed in.
    if (data.session) redirect(destination);

    await setPendingEmail(address);
    if (inline === "1") return { confirmEmail: true as const, email: address };
    redirect("/verify-email");
  },
});

// ---------------------------------------------------------------------------
export const resendConfirmation = formAction({
  name: "resend-confirmation",
  auth: "public",
  captcha: true,
  rateLimit: { limit: 5, window: "1 h" },
  schema: z.object({ email: email.optional(), next: z.string().optional() }),
  async handler({ email: typed, next }, { supabase }) {
    // Prefer the address we stored when the email was first sent; otherwise use what was typed.
    const address = (await getPendingEmail()) ?? typed;
    if (!address) {
      throw new AppError("VALIDATION", undefined, { fieldErrors: { email: ["Enter your email address."] } });
    }
    await limitByEmail("resend", address.toLowerCase(), 3, "1 h");

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: address,
      options: { emailRedirectTo: confirmUrl(safeNext(next)) },
    });
    // Only surface rate limits; never reveal whether the address exists or is already confirmed.
    if (error) {
      const mapped = fromAuthError(error);
      if (mapped.code === "RATE_LIMITED") throw mapped;
    }
    return { sent: true as const };
  },
});

// ---------------------------------------------------------------------------
export const forgotPassword = formAction({
  name: "forgot-password",
  auth: "public",
  captcha: true,
  rateLimit: { limit: 5, window: "1 h" },
  schema: z.object({ email }),
  async handler({ email: address }, { supabase }) {
    await limitByEmail("forgot", address, 3, "1 h");

    const { error } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: confirmUrl("/reset-password"),
    });
    if (error) {
      const mapped = fromAuthError(error);
      if (mapped.code === "RATE_LIMITED") throw mapped;
    }
    // Same answer whether or not the address has an account.
    return { sent: true as const };
  },
});

// ---------------------------------------------------------------------------
/** Runs on a session created by the emailed recovery link. */
export const resetPassword = formAction({
  name: "reset-password",
  auth: "user",
  mfa: "skip", // the emailed recovery link is the proof of identity here; blocking it would lock out anyone who lost their phone
  rateLimit: { limit: 10, window: "1 h" },
  schema: z
    .object({ password: newPassword, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match." }),
  async handler({ password }, { supabase }) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw fromAuthError(error);
    // Any other device that was signed in must sign in again with the new password.
    await supabase.auth.signOut({ scope: "others" });
    await clearPendingEmail();
    redirect("/dashboard?notice=password-updated");
  },
});

// ---------------------------------------------------------------------------
export const logout = action({
  name: "logout",
  auth: "public",
  schema: z.object({ next: z.string().optional() }),
  async handler({ next }, { supabase }) {
    await supabase.auth.signOut();
    redirect(safeNext(next, "/"));
  },
});
