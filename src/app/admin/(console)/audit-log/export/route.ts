import { toCsv } from "@/lib/admin/db";
import { logExport } from "@/lib/admin/export-log";
import { csvResponse, exportGuard } from "@/lib/admin/export-guard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CAP = 20_000;

/** The audit log as CSV, with the same filters as the page, capped at 20,000 rows. The export itself is logged. */
export async function GET(request: Request) {
  const guard = await exportGuard("audit");
  if ("response" in guard) return guard.response;

  const sp = new URL(request.url).searchParams;
  const action = sp.get("action")?.slice(0, 60) || undefined;
  const entity = sp.get("entity")?.slice(0, 40) || undefined;
  const actor = sp.get("actor") && UUID.test(sp.get("actor")!) ? sp.get("actor")! : undefined;
  const from = sp.get("from") && DATE.test(sp.get("from")!) ? sp.get("from")! : undefined;
  const to = sp.get("to") && DATE.test(sp.get("to")!) ? sp.get("to")! : undefined;

  const supabase = await createClient();
  let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(CAP);
  if (action) q = q.ilike("action", `${action.replace(/[%_\\]/g, "")}%`);
  if (entity) q = q.eq("entity_type", entity);
  if (actor) q = q.eq("actor_id", actor);
  if (from) q = q.gte("created_at", `${from}T00:00:00Z`);
  if (to) q = q.lt("created_at", new Date(Date.parse(`${to}T00:00:00Z`) + 86_400_000).toISOString());
  const { data, error } = await q;
  if (error) return new Response("The export failed.", { status: 500 });

  const rows = data ?? [];
  await logExport(guard.user.id, "audit_logs", rows.length, { action, entity, actor, from, to });
  const body = toCsv(
    ["time_utc", "actor_id", "actor_role", "action", "entity_type", "entity_id", "reason", "ip", "before", "after"],
    rows.map((r) => [r.created_at, r.actor_id, r.actor_role, r.action, r.entity_type, r.entity_id, r.reason, r.ip ? String(r.ip).split("/")[0] : "", r.before ? JSON.stringify(r.before) : "", r.after ? JSON.stringify(r.after) : ""]),
  );
  return csvResponse(body, `audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
}
