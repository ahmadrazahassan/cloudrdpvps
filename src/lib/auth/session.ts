import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { needsSecondFactor } from "@/lib/auth/mfa";
import { loginUrl, verifyUrl } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type Profile = Tables<"profiles">;

export interface SessionUser {
  id: string;
  email: string;
  emailVerified: boolean;
  profile: Profile;
}

/**
 * The signed-in user for this request, or null.
 *
 * Uses `auth.getUser()` — it asks the Auth server, so a revoked, banned or
 * deleted session is rejected immediately (the JWT alone stays valid until it
 * expires). The profile (role, status) is read fresh from the database every
 * time, so a demoted admin loses access on their next request.
 * Memoised per request with React `cache`.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  if (!profile) return null;

  return {
    id: data.user.id,
    email: profile.email,
    emailVerified: Boolean(data.user.email_confirmed_at),
    profile,
  };
});

export const isStaff = (u: SessionUser) => u.profile.role === "support" || u.profile.role === "admin";
export const isAdmin = (u: SessionUser) => u.profile.role === "admin";

/**
 * Signed-in customers (and staff). Sends everyone else to the login page — and anyone who has an authenticator
 * but hasn't entered a code in this session to the code screen, so a stolen password alone never opens a screen.
 */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(loginUrl(next, "session"));
  if (await needsSecondFactor()) redirect(verifyUrl(next));
  return user;
}

/** Support or admin. Anyone else gets a 404 so the admin area isn't advertised. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (!isStaff(user)) notFound();
  return user;
}

/** Admin only (money, roles, settings). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (!isAdmin(user)) notFound();
  return user;
}
