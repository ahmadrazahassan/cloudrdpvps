import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabasePublic } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Per-request Supabase client acting as the signed-in user (anon key + the
 * user's session cookies). Every query runs under RLS as that user.
 *
 * Create one per request/action — never cache it at module level, or one
 * visitor's session could leak into another's request.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabasePublic();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // proxy refreshes the session on every navigation, so this is safe.
        }
      },
    },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
