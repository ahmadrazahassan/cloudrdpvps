import { z } from "zod";
import { normalizeWhatsAppInput } from "@/lib/whatsapp";

/**
 * What Admin → Settings accepts, and how a saved group turns into `site_settings` rows. Pure (no I/O) so it is tested
 * directly; the server action in actions/system.ts only authenticates and writes.
 */

/** Keys that the public site may read; everything else is staff-only. Mirrors supabase/seed.sql. */
export const PUBLIC_KEYS = new Set(["site_name", "support_email", "whatsapp", "telegram", "review_eta", "delivery_eta", "maintenance", "announcement", "term_days"]);

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

export const GROUPS = {
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

/**
 * The `[key, value]` pairs to store for one settings group, from the already-validated values.
 *
 * `site_settings.value` is `jsonb NOT NULL`, and a JSON `null` sent through the API arrives as SQL NULL — which the
 * column rejects. So a cleared optional field (no Telegram link, no support email…) is stored as an empty string;
 * every reader (`mapSiteSettings`, the email context, the settings page) already treats "" and "not set" alike.
 */
export function settingEntries(group: SettingsGroup, v: Record<string, unknown>): [string, unknown][] {
  const entries: [string, unknown][] =
    group === "operations"
      ? [
          ["maintenance", { enabled: v.maintenance_enabled, message: v.maintenance_message }],
          ["low_stock_threshold", v.low_stock_threshold],
        ]
      : Object.entries(v);
  return entries.map(([key, value]) => [key, value ?? ""]);
}
