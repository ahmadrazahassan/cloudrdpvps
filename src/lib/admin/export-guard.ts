import "server-only";
import { getStaffAal } from "@/lib/auth/mfa";
import { getSessionUser, isAdmin, type SessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/** Shared gate for CSV downloads: signed in, admin, second factor passed, and not hammering the endpoint. */
export async function exportGuard(name: string): Promise<{ user: SessionUser } | { response: Response }> {
  const user = await getSessionUser();
  if (!user) return { response: text("Please sign in.", 401) };
  if (!isAdmin(user)) return { response: text("Not found", 404) };
  if (!(await getStaffAal()).satisfied) return { response: text("Confirm your authenticator code first.", 403) };
  const limit = await rateLimit({ name: `export-${name}`, id: user.id, limit: 10, window: "10 m" });
  if (!limit.ok) return { response: text("Too many exports. Please wait a few minutes.", 429) };
  return { user };
}

export const MAX_EXPORT_ROWS = 50_000;

/** A CSV download response with a safe filename. */
export function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^a-z0-9._-]/gi, "_")}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
