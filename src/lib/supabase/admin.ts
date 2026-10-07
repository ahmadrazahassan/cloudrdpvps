import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireSupabasePublic } from "@/lib/env";
import { requireServerEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * Service-role client: BYPASSES row-level security.
 *
 * Use it only for work no user is allowed to do themselves — cron jobs, the
 * email outbox, signed storage URLs for staff, the first-admin bootstrap.
 * Never hand it user-controlled table names or filters, and never import it
 * from a file that a Client Component can reach (`server-only` enforces this).
 */
export function createAdminClient() {
  const { url } = requireSupabasePublic();
  return createClient<Database>(url, requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
