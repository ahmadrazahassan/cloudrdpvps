import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface StaffAal {
  /** The `require_staff_mfa` site setting (default on). */
  required: boolean;
  /** The user has a verified authenticator factor. */
  enrolled: boolean;
  /** Safe to let them into the console: MFA is off, or this session already passed the second factor (AAL2). */
  satisfied: boolean;
}

/**
 * Where this session stands on multi-factor authentication, read from the session token (no network call).
 *   current — what this session has proven (aal1 = password, aal2 = password + authenticator code)
 *   next    — what it could prove: "aal2" means the account HAS a verified authenticator
 * `needsSecondFactor` is the gate for every signed-in screen and action: the person typed the right password but
 * has an authenticator and hasn't yet entered a code in this session.
 */
export const getSessionAal = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const current = data?.currentLevel ?? "aal1";
  const next = data?.nextLevel ?? "aal1";
  return { current, next, enrolled: next === "aal2" || current === "aal2", needsSecondFactor: next === "aal2" && current !== "aal2" };
});

export const needsSecondFactor = async () => (await getSessionAal()).needsSecondFactor;

/**
 * Staff additionally need a second factor if the `require_staff_mfa` setting says so — even if they haven't set
 * one up yet (then they are sent to enrol). The database does not know about AAL, so this is an application gate:
 * the console layout and every staff/admin Server Action call it. It fails closed — if the setting can't be read,
 * MFA is treated as required.
 */
export const getStaffAal = cache(async (): Promise<StaffAal> => {
  const supabase = await createClient();
  const [setting, aal] = await Promise.all([
    supabase.from("site_settings").select("value").eq("key", "require_staff_mfa").maybeSingle(),
    getSessionAal(),
  ]);
  const required = setting.error ? true : setting.data?.value !== false;
  return { required, enrolled: aal.enrolled, satisfied: !required || aal.current === "aal2" };
});

/** Does this signed-in person have an authenticator app set up? (For the Security settings page.) */
export const getCustomerMfa = cache(async (): Promise<{ enabled: boolean }> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  return { enabled: (data?.totp ?? []).length > 0 };
});
