import "server-only";
import { serverEnv } from "@/lib/env.server";

export const TURNSTILE_FIELD = "cf-turnstile-response";

let warned = false;

/**
 * Verify a Cloudflare Turnstile token.
 *
 * - No secret configured  -> allowed (with a one-time warning). Rate limits and
 *   Supabase Auth's own protections still apply; configure both Turnstile keys
 *   before launch.
 * - Secret configured     -> a valid token is REQUIRED; network failure or a
 *   missing token fails closed.
 */
export async function verifyTurnstile(token: unknown, ip?: string): Promise<boolean> {
  const { TURNSTILE_SECRET_KEY: secret } = serverEnv();
  if (!secret) {
    if (!warned) {
      warned = true;
      console.warn("[turnstile] TURNSTILE_SECRET_KEY is not set — bot checks are disabled.");
    }
    return true;
  }
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}
