import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requireSupabasePublic } from "@/lib/env";
import type { Database } from "@/types/database";

export interface ProxySession {
  /** Response to return (or copy cookies from) so refreshed tokens reach the browser. */
  response: NextResponse;
  /** Verified JWT claims, or null when signed out. */
  userId: string | null;
}

/**
 * Refreshes the session cookie and verifies the JWT. Called from `proxy.ts`.
 * Authorisation is NOT decided here beyond "is someone signed in" — roles live
 * in the database and are enforced by RLS + RPCs and re-checked in server code.
 */
export async function updateSession(request: NextRequest): Promise<ProxySession> {
  const { url, anonKey } = requireSupabasePublic();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        // Responses that carry auth cookies must never be cached by a CDN.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return { response, userId: typeof sub === "string" ? sub : null };
}

/** Redirect while keeping any session cookies the refresh just set. */
export function redirectKeepingCookies(request: NextRequest, to: string | URL, from: NextResponse) {
  const target = typeof to === "string" ? new URL(to, request.url) : to;
  const redirect = NextResponse.redirect(target);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  from.headers.forEach((value, key) => {
    if (key.toLowerCase() === "cache-control" || key === "expires" || key === "pragma") redirect.headers.set(key, value);
  });
  return redirect;
}
