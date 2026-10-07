import { getSessionUser } from "@/lib/auth/session";
import { fromDbError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { buildRdpFile, rdpFilename } from "@/lib/security/rdp-file";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/**
 * Downloads a Windows Remote Desktop (.rdp) file for one server: address, port and username, set to
 * prompt for the password (it never contains it). Same rules as revealing credentials — the
 * database function checks ownership and that the server is active, and audits the access.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return text("Not found", 404);

  const user = await getSessionUser();
  if (!user) return text("Please sign in.", 401);

  const limit = await rateLimit({ name: "rdp-download", id: user.id, limit: 10, window: "10 m" });
  if (!limit.ok) return text("Too many downloads. Please wait a moment.", 429);

  const supabase = await createClient();
  const { data: service } = await supabase
    .from("services")
    .select("label, ip, rdp_port")
    .eq("id", id)
    .maybeSingle();
  if (!service) return text("Not found", 404);

  const { data, error } = await supabase.rpc("get_service_credentials", { p_service_id: id });
  if (error) {
    const mapped = fromDbError(error);
    const status = mapped.code === "SERVICE_NOT_ACTIVE" ? 409 : mapped.code === "NOT_FOUND" ? 404 : 403;
    return text(mapped.message, status);
  }
  const username = data?.[0]?.username;
  if (!username) return text("Not found", 404);

  let body: string;
  try {
    body = buildRdpFile({ host: String(service.ip).split("/")[0]!, port: service.rdp_port, username });
  } catch {
    return text("This server's address can't be turned into a connection file.", 422);
  }

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-rdp",
      "Content-Disposition": `attachment; filename="${rdpFilename(service.label)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
