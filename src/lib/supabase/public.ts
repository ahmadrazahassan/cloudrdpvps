import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireSupabasePublic } from "@/lib/env";
import type { Database } from "@/types/database";

/** Tag that every public catalog read carries; admin edits call `updateTag(CATALOG_TAG)`. */
export const CATALOG_TAG = "catalog";
/** Seconds a catalog response stays fresh even if nobody invalidates it. */
export const CATALOG_REVALIDATE = 300;

/**
 * GET requests to PostgREST are tagged so Next's data cache can serve them and
 * admin edits can invalidate them. Each response is also tagged with its table
 * (`db:plans`) for finer invalidation later.
 */
const taggedFetch: typeof fetch = (input, init) => {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const table = new URL(href).pathname.split("/").filter(Boolean).pop() ?? "unknown";
  return fetch(input, {
    ...init,
    next: { revalidate: CATALOG_REVALIDATE, tags: [CATALOG_TAG, `db:${table}`] },
  });
};

/**
 * Cookie-less, session-less client for data every visitor may read (plans,
 * prices, locations, FAQs, active payment-method names). It carries no user
 * identity, so cached responses can never leak per-user data.
 */
export function createPublicClient() {
  const { url, anonKey } = requireSupabasePublic();
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: taggedFetch },
  });
}
