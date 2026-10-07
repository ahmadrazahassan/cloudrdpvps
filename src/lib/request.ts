import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort client address for rate limiting and audit rows. Trusts the
 * first hop of `x-forwarded-for` (set by the platform's edge), which is only
 * safe when the app runs behind one. It is a throttle key, never a credential.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || h.get("x-real-ip")?.trim() || "unknown";
}

export async function getUserAgent(): Promise<string | null> {
  const h = await headers();
  return h.get("user-agent")?.slice(0, 300) ?? null;
}
