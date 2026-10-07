"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/action";
import { AppError, fromDbError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATALOG_TAG } from "@/lib/supabase/public";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { renderEmail } from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { uuid } from "@/lib/validation";
import { normalizeWhatsAppInput } from "@/lib/whatsapp";
import { SUSPEND_REASONS } from "../reasons";

const bust = () => {
  updateTag(CATALOG_TAG);
  revalidatePath("/", "layout");
};

// ---------------------------------------------------------------------------
// Site settings
// ---------------------------------------------------------------------------

/** Keys that the public site may read; everything else is staff-only. Mirrors supabase/seed.sql. */
const PUBLIC_KEYS = new Set(["site_name", "support_email", "whatsapp", "telegram", "review_eta", "delivery_eta", "maintenance", "announcement", "term_days"]);

const text = (max: number) => z.string().trim().max(max).transform((v) => (v === "" ? null : v));
const int = (min: number, max: number, label: string) => z.coerce.number({ error: `${label} must be a number.` }).int(`${label} must be a whole number.`).min(min, `${label} can't be below ${min}.`).max(max, `${label} can't be above ${max}.`);
const link = text(300).refine((v) => v === null || /^https:\/\/\S+$/i.test(v), "Use a full link starting with https://, e.g. https://wa.me/923001234567.");

// A number with its country code ("+92 300 1234567") or a WhatsApp link — saved as the canonical https://wa.me/<number> link,
// so the footer, the contact page and the floating chat all read the same thing.
const whatsappLink = text(300)
  .refine((v) => v === null || normalizeWhatsAppInput(v).ok, "Enter your WhatsApp number with its country code (e.g. +92 300 1234567) or a https://wa.me/… link.")
  .transform((v) => {
    if (v === null) return null;
    const n = normalizeWhatsAppInput(v);
    return n.ok ? n.value : null;
  });

const GROUPS = {
  general: z.object({
    site_name: z.string().trim().min(2, "Enter the site name.").max(60),
    support_email: text(120).refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address."),
    whatsapp: whatsappLink,
    telegram: link,
    company_block: text(600),
  }),
  orders: z.object({
    unpaid_order_hours: int(1, 720, "Unpaid order window"),
    reject_extension_hours: int(1, 720, "Extra time after a rejection"),
    max_open_orders: int(1, 50, "Open order limit"),
    grace_days: int(0, 60, "Grace period"),
    reminder_days: z
      .string()
      .trim()
      .transform((v) => v.split(/[,\s]+/).filter(Boolean).map(Number))
      .refine((a) => a.length > 0 && a.length <= 5 && a.every((n) => Number.isInteger(n) && n >= 1 && n <= 30), "Use up to 5 whole days between 1 and 30, e.g. 3, 1."),
    review_eta: text(120),
    delivery_eta: text(120),
  }),
  operations: z.object({
    maintenance_enabled: z.boolean(),
    maintenance_message: z.string().trim().max(240),
    low_stock_threshold: int(0, 1000, "Low-stock threshold"),
  }),
  security: z.object({ require_staff_mfa: z.boolean() }),
} as const;

export type SettingsGroup = keyof typeof GROUPS;

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
    const entries: [string, unknown][] =
      group === "operations"
        ? [
            ["maintenance", { enabled: v.maintenance_enabled, message: v.maintenance_message }],
            ["low_stock_threshold", v.low_stock_threshold],
          ]
        : Object.entries(v);

    const now = new Date().toISOString();
    const rows = entries.map(([key, value]) => ({ key, value: value as never, is_public: PUBLIC_KEYS.has(key), updated_by: user!.id, updated_at: now }));
    const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
    if (error) throw fromDbError(error);
    bust();
    return { saved: rows.length };
  },
});

/** Send a test email to the signed-in admin, to confirm sending works end to end. */
export const sendTestEmail = action({
  name: "admin-test-email",
  auth: "admin",
  rateLimit: { limit: 5, window: "10 m" },
  schema: z.object({}),
  async handler(_input, { user }) {
    if (!emailConfigured()) {
      throw new AppError("UNAVAILABLE", "Email isn't set up yet. Add RESEND_API_KEY and EMAIL_FROM to the server's environment.");
    }
    const mail = renderEmail("test", {}, { siteName: "Cloud RDP VPS", siteUrl: publicEnv.siteUrl, supportEmail: null });
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
