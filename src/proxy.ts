import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { loginUrl, safeNext } from "@/lib/redirect";
import { redirectKeepingCookies, updateSession } from "@/lib/supabase/proxy";

/**
 * Runs before matching routes render. It does two small jobs:
 *   1. refreshes the Supabase session cookie so tokens never go stale mid-visit;
 *   2. turns "signed out on a private page" into a redirect to /login.
 *
 * It deliberately does NOT decide roles — those live in the database and are
 * enforced by RLS, the RPCs, and `requireStaff()/requireAdmin()` in server
 * code. Server Actions are POSTs to their page, so every action re-checks
 * auth itself; never rely on this file alone.
 */
// /order/new is public on purpose: visitors can configure a plan while signed out, and are asked to
// sign in only when they place the order (the server action requires a session).
const PRIVATE_PREFIXES = ["/dashboard", "/admin", "/login/verify"];
const GUEST_ONLY = ["/login", "/register", "/forgot-password"];

const isUnder = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

export async function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const isPrivate = PRIVATE_PREFIXES.some((p) => isUnder(pathname, p));
  const isGuestOnly = GUEST_ONLY.includes(pathname);

  // No backend configured (fresh checkout): there are no accounts to protect or to sign in to.
  if (!isSupabaseConfigured) {
    return isPrivate ? NextResponse.redirect(new URL(loginUrl(pathname + search), request.url)) : NextResponse.next();
  }

  const { response, userId } = await updateSession(request);

  if (isPrivate && !userId) {
    return redirectKeepingCookies(request, loginUrl(pathname + search), response);
  }

  // Already signed in: skip the auth screens — unless the server just rejected this session.
  if (isGuestOnly && userId && searchParams.get("reason") !== "session") {
    return redirectKeepingCookies(request, safeNext(searchParams.get("next")), response);
  }

  return response;
}

export const config = {
  // Constants only — Next analyses these at build time.
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/login/verify", "/register", "/forgot-password"],
};
