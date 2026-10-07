import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { requireAdmin, requireStaff, type SessionUser } from "@/lib/auth/session";
import { getStaffAal } from "@/lib/auth/mfa";

async function mfaGate() {
  const aal = await getStaffAal();
  if (!aal.satisfied) redirect("/admin/mfa");
}

/**
 * Gate for every console page. Layouts and pages render in parallel in the App Router, so the layout's
 * check is never enough on its own: each page calls this (or `requireAdminConsole`) before it reads anything.
 * Non-staff get a 404, signed-out visitors go to /login, staff without a second factor go to /admin/mfa.
 */
export const requireConsole = cache(async (): Promise<SessionUser> => {
  const user = await requireStaff();
  await mfaGate();
  return user;
});

/** Same, for money / catalog / settings pages that only the admin role may open. */
export const requireAdminConsole = cache(async (): Promise<SessionUser> => {
  const user = await requireAdmin();
  await mfaGate();
  return user;
});
