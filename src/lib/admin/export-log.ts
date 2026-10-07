import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env.server";

/**
 * Record that someone exported data. The audit table has no insert permission for signed-in users (rows are
 * written by database functions), so this uses the service role — and only to append. Best effort: if the
 * service key isn't configured the export is still allowed, but the log line is skipped with a console warning.
 */
export async function logExport(actorId: string, kind: string, rows: number, filters: Record<string, string | null | undefined>) {
  if (!serverEnv().SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(`[export] ${kind} exported by ${actorId} (${rows} rows) — not audited: SUPABASE_SERVICE_ROLE_KEY missing`);
    return;
  }
  const { error } = await createAdminClient()
    .from("audit_logs")
    .insert({ actor_id: actorId, actor_role: "admin", action: "export.csv", entity_type: kind, after: { rows, filters } as never });
  if (error) console.error("[export] audit insert failed:", error.message);
}
