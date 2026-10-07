/**
 * Only ever redirect to a path on this site. Anything that could leave the
 * origin — absolute URLs, protocol-relative `//host`, backslash tricks,
 * control characters — falls back to the default.
 */
export function safeNext(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  try {
    // Resolve against a dummy origin; if the origin changes, it wasn't a plain path.
    const resolved = new URL(value, "http://safe.invalid");
    if (resolved.origin !== "http://safe.invalid") return fallback;
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return fallback;
  }
}

/** Where someone who has typed their password but not yet their authenticator code is sent. */
export const verifyUrl = (next?: string) => (next && next !== "/dashboard" ? `/login/verify?next=${encodeURIComponent(next)}` : "/login/verify");

/**
 * `/login?next=/dashboard/orders` — the destination is validated on the way back in.
 * `reason=session` marks a bounce caused by a session the server no longer accepts
 * (e.g. a deleted account whose JWT hasn't expired); the proxy lets that visit
 * reach the login page instead of bouncing it back to the dashboard forever.
 */
export function loginUrl(next?: string, reason?: "session") {
  const params = new URLSearchParams();
  if (next && next !== "/") params.set("next", next);
  if (reason) params.set("reason", reason);
  const qs = params.toString();
  return qs ? `/login?${qs}` : "/login";
}
