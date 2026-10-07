"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/action";
import { AppError, fromDbError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATALOG_TAG } from "@/lib/supabase/public";
import { loadEmailContext } from "@/lib/email/context";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { renderEmail } from "@/lib/email/templates";
import { serverEnv } from "@/lib/env.server";
import { uuid } from "@/lib/validation";
import { SUSPEND_REASONS } from "../reasons";
import { GROUPS, PUBLIC_KEYS, settingEntries } from "../settings-schema";

const bust = () => {
  updateTag(CATALOG_TAG);
  revalidatePath("/", "layout");
};

// ---------------------------------------------------------------------------
// Site settings
// ---------------------------------------------------------------------------

export const saveSettings = action({
  name: "admin-save-settings",
  auth: "admin",
  rateLimit: { limit: 60, window: "1 h" },
  schema: z.object({ group: z.enum(["general", "orders", "operations", "security"]), values: z.record(z.string(), z.union([z.string(), z.boolean()])) }),
  async handler({ group, values }, { supabase, user }) {
    const parsed = GROUPS[group].safeParse(values);
    if (!parsed.success) {
      throw new AppError("VALIDATION", undefined, { fieldErrors: z.flattenError(parsed.error as z.ZodError).fieldErrors as Record<string, string[]> });
    }
    const v = parsed.data as Record<string, unknown>;
    const now = new Date().toISOString();
    const rows = settingEntries(group, v).map(([key, value]) => ({ key, value: value as never, is_public: PUBLIC_KEYS.has(key), updated_by: user!.id, updated_at: now }));
    const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
    if (error) throw fromDbError(error);
    bust();
    // Echo what was actually stored for the text fields, so the form can show the tidied value (a typed number becomes its wa.me link).
    return { saved: rows.length, stored: Object.fromEntries(rows.filter((r) => typeof r.value === "string").map((r) => [r.key, r.value as string])) };
  },
});

/** Send a test email to the signed-in admin, to confirm sending works end to end. */
export const sendTestEmail = action({
  name: "admin-test-email",
  auth: "admin",
  rateLimit: { limit: 5, window: "10 m" },
  schema: z.object({}),
  async handler(_input, { user, supabase }) {
    if (!emailConfigured()) {
      throw new AppError("UNAVAILABLE", "Email isn't set up yet. Add RESEND_API_KEY and EMAIL_FROM to the server's environment.");
    }
    const mail = renderEmail("test", {}, await loadEmailContext(supabase));
    const sent = await sendEmail({ to: user!.email, ...mail! });
    if (!sent.ok) throw new AppError("INTERNAL", `The email provider refused it: ${sent.error}`);
    return { to: user!.email };
  },
});

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------
export const setStaffRole = action({
  name: "admin-set-role",
  auth: "admin",
  rateLimit: { limit: 60, window: "1 h" },
  schema: z.object({ userId: uuid, role: z.enum(["customer", "support", "admin"]) }),
  async handler({ userId, role }, { supabase }) {
    const { error } = await supabase.rpc("set_user_role", { p_user_id: userId, p_role: role });
    if (error) throw fromDbError(error);
    revalidatePath("/admin/team");
    return { role };
  },
});

export const setStaffActive = action({
  name: "admin-set-staff-active",
  auth: "admin",
  rateLimit: { limit: 60, window: "1 h" },
  schema: z.object({ userId: uuid, active: z.boolean(), reason: z.enum(SUSPEND_REASONS).optional() }),
  async handler({ userId, active, reason }, { supabase }) {
    const { error } = await supabase.rpc("set_account_status", { p_user_id: userId, p_status: active ? "active" : "suspended", p_reason: active ? null : (reason ?? "Other") });
    if (error) throw fromDbError(error);
    revalidatePath("/admin/team");
    return { active };
  },
});

/**
 * Give someone staff access. An existing account is promoted by email; for a new person an invitation
 * email is sent through Supabase Auth (needs the service-role key) and the role is set once they exist.
 */
export const addStaff = action({
  name: "admin-add-staff",
  auth: "admin",
  rateLimit: { limit: 20, window: "1 h" },
  schema: z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address."), role: z.enum(["support", "admin"]) }),
  async handler({ email, role }, { supabase }) {
    const existing = await supabase.from("profiles").select("id, role").ilike("email", email).maybeSingle();
    if (existing.error) throw fromDbError(existing.error);

    let userId = existing.data?.id ?? null;
    let invited = false;
    if (!userId) {
      if (!serverEnv().SUPABASE_SERVICE_ROLE_KEY) {
        throw new AppError("UNAVAILABLE", "That person doesn't have an account yet. Ask them to register first, or add the Supabase service-role key to invite them from here.");
      }
      const invite = await createAdminClient().auth.admin.inviteUserByEmail(email);
      if (invite.error || !invite.data.user) {
        throw new AppError("VALIDATION", undefined, { fieldErrors: { email: ["The invitation couldn't be sent. Check the address and try again."] }, cause: invite.error });
      }
      userId = invite.data.user.id;
      invited = true;
    }
    const { error } = await supabase.rpc("set_user_role", { p_user_id: userId, p_role: role });
    if (error) throw fromDbError(error);
    revalidatePath("/admin/team");
    return { invited };
  },
});
