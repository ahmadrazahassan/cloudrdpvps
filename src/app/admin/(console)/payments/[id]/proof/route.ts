import { NextResponse } from "next/server";
import { getStaffAal } from "@/lib/auth/mfa";
import { getSessionUser, isStaff } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/**
 * Serves one payment proof to staff: checks the session, role and second factor, then redirects to a
 * signed storage link that is valid for 60 seconds. The page never contains a storage URL, so a copied
 * page or a leaked screenshot can't be used to fetch the file later.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return text("Not found", 404);

  const user = await getSessionUser();
  if (!user) return text("Please sign in.", 401);
  if (!isStaff(user)) return text("Not found", 404);
  if (!(await getStaffAal()).satisfied) return text("Confirm your authenticator code first.", 403);

  const limit = await rateLimit({ name: "admin-proof", id: user.id, limit: 240, window: "10 m" });
  if (!limit.ok) return text("Too many requests. Please wait a moment.", 429);

  const supabase = await createClient();
  const { data: payment } = await supabase.from("payments").select("proof_path").eq("id", id).maybeSingle();
  if (!payment) return text("Not found", 404);

  const signed = await supabase.storage.from("payment-proofs").createSignedUrl(payment.proof_path, 60);
  if (signed.error || !signed.data?.signedUrl) return text("The file couldn't be found.", 404);

  return NextResponse.redirect(signed.data.signedUrl, { status: 302, headers: { "Cache-Control": "no-store" } });
}
