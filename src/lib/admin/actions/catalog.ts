"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { action, formAction } from "@/lib/action";
import { checkUpload } from "@/lib/security/file-sniff";
import { CATALOG_TAG } from "@/lib/supabase/public";
import { optionalText, uuid } from "@/lib/validation";
import { lines, throwSaveError } from "../save-error";
import { parseUsdToCents } from "../money";
import { AppError, fromDbError } from "@/lib/errors";

/** Public pages read the catalog through a tagged cache; expire it so edits show on the site straight away. */
const bust = () => {
  updateTag(CATALOG_TAG);
  revalidatePath("/", "layout");
};

const flag = z.boolean().default(false);
const id = z.union([z.literal(""), uuid]).optional();

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens.")
  .min(2, "At least 2 characters.")
  .max(40, "Up to 40 characters.");

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------
export const savePlan = action({
  name: "admin-save-plan",
  auth: "admin",
  rateLimit: { limit: 120, window: "1 h" },
  schema: z.object({
    id,
    product: z.enum(["rdp", "vps"], { error: "Choose RDP or VPS." }),
    name: z.string().trim().min(2, "Enter a name.").max(60),
    slug,
    vcpu: z.coerce.number().int("Whole numbers only.").min(1).max(128),
    ram_gb: z.coerce.number().int("Whole numbers only.").min(1).max(2048),
    storage_gb: z.coerce.number().int("Whole numbers only.").min(10).max(20000),
    bandwidth_tb: z.coerce.number().min(0).max(1000),
    port_mbps: z.coerce.number().int("Whole numbers only.").min(10).max(100000),
    features: z.string().max(1200).default(""),
    is_featured: flag,
    sort_order: z.coerce.number().int().min(0).max(10000).default(0),
    is_active: flag,
  }),
  async handler({ id: planId, features, ...v }, { supabase }) {
    const list = lines(features);
    if (list.length > 6) throw new AppError("VALIDATION", undefined, { fieldErrors: { features: ["Use up to 6 feature lines."] } });
    const row = { ...v, features: list };
    const { error } = planId ? await supabase.from("plans").update(row).eq("id", planId) : await supabase.from("plans").insert(row);
    if (error) throwSaveError(error, "slug", "Another plan already uses that slug.");
    bust();
    return { saved: true as const };
  },
});

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------
export const saveLocation = action({
  name: "admin-save-location",
  auth: "admin",
  rateLimit: { limit: 120, window: "1 h" },
  schema: z.object({
    id,
    name: z.string().trim().min(2, "Enter a name.").max(60),
    slug,
    iso2: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use the 2-letter country code, e.g. PK."),
    blurb: optionalText(300),
    image_key: optionalText(60),
    sort_order: z.coerce.number().int().min(0).max(10000).default(0),
    is_active: flag,
  }),
  async handler({ id: locId, blurb, image_key, ...v }, { supabase }) {
    const row = { ...v, blurb: blurb ?? null, image_key: image_key ?? null };
    const { error } = locId ? await supabase.from("locations").update(row).eq("id", locId) : await supabase.from("locations").insert(row);
    if (error) throwSaveError(error, "slug", "Another location already uses that slug.");
    bust();
    return { saved: true as const };
  },
});

// ---------------------------------------------------------------------------
// Pricing & stock matrix: one save for every edited cell
// ---------------------------------------------------------------------------
export const savePricing = action({
  name: "admin-save-pricing",
  auth: "admin",
  rateLimit: { limit: 60, window: "1 h" },
  schema: z.object({
    changes: z
      .array(
        z.object({
          planId: uuid,
          locationId: uuid,
          price: z.string().trim(),
          stock: z.enum(["in_stock", "low", "out_of_stock"]),
          stockCount: z.union([z.literal(""), z.coerce.number().int().min(0).max(100000)]).optional(),
          active: z.boolean(),
        }),
      )
      .min(1, "Nothing to save.")
      .max(400, "Too many changes at once."),
  }),
  async handler({ changes }, { supabase }) {
    const rows = changes.map((c) => {
      const cents = parseUsdToCents(c.price);
      if (cents === null || cents <= 0) {
        throw new AppError("VALIDATION", `“${c.price}” isn't a valid price. Use something like 24.99.`, { fieldErrors: { changes: [`“${c.price}” isn't a valid price.`] } });
      }
      return {
        plan_id: c.planId,
        location_id: c.locationId,
        price_cents: cents,
        stock: c.stock,
        stock_count: c.stockCount === "" || c.stockCount === undefined ? null : c.stockCount,
        is_active: c.active,
        updated_at: new Date().toISOString(),
      };
    });
    const { error } = await supabase.from("plan_pricing").upsert(rows, { onConflict: "plan_id,location_id" });
    if (error) throw fromDbError(error);
    bust();
    return { saved: rows.length };
  },
});

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------
export const savePaymentMethod = action({
  name: "admin-save-payment-method",
  auth: "admin",
  rateLimit: { limit: 120, window: "1 h" },
  schema: z.object({
    id,
    name: z.string().trim().min(2, "Enter a name.").max(80),
    type: z.enum(["bank", "mobile_wallet", "upi", "crypto", "other"], { error: "Choose a type." }),
    regions: z.string().max(80).default(""),
    currency_code: z.string().trim().toUpperCase().regex(/^([A-Z]{3})?$/, "Use a 3-letter currency code, e.g. PKR.").default(""),
    rate_per_usd: z.string().trim().default(""),
    fee_note: optionalText(200),
    details: z.string().max(2000).default(""),
    instructions_md: optionalText(4000),
    requires_reference: flag,
    sort_order: z.coerce.number().int().min(0).max(10000).default(0),
    is_active: flag,
  }),
  async handler({ id: methodId, regions, currency_code, rate_per_usd, details, fee_note, instructions_md, ...v }, { supabase }) {
    const regionList = regions
      .split(/[\s,]+/)
      .map((r) => r.trim().toUpperCase())
      .filter(Boolean);
    if (regionList.some((r) => !/^[A-Z]{2}$/.test(r))) {
      throw new AppError("VALIDATION", undefined, { fieldErrors: { regions: ["Use 2-letter country codes separated by commas, e.g. PK, IN. Leave empty for everywhere."] } });
    }
    const rate = rate_per_usd === "" ? null : Number(rate_per_usd);
    if (rate !== null && (!Number.isFinite(rate) || rate <= 0)) {
      throw new AppError("VALIDATION", undefined, { fieldErrors: { rate_per_usd: ["Enter how many local units equal 1 USD, e.g. 285."] } });
    }
    if (rate !== null && !currency_code) {
      throw new AppError("VALIDATION", undefined, { fieldErrors: { currency_code: ["Enter the currency code, e.g. PKR."] } });
    }
    // account details: one "Label: value" per line
    const detailRows = lines(details).flatMap((l) => {
      const at = l.indexOf(":");
      if (at < 1) return [];
      const label = l.slice(0, at).trim();
      const value = l.slice(at + 1).trim();
      return label && value ? [{ label: label.slice(0, 60), value: value.slice(0, 200) }] : [];
    });

    let existing: { rate_per_usd: number | null } | null = null;
    if (methodId) {
      const r = await supabase.from("payment_methods").select("rate_per_usd").eq("id", methodId).maybeSingle();
      existing = r.data;
    }
    const row = {
      ...v,
      regions: regionList,
      currency_code: currency_code || null,
      rate_per_usd: rate,
      // "rate last updated" only moves when the rate itself changes
      ...(rate !== (existing?.rate_per_usd ?? null) ? { rate_updated_at: rate === null ? null : new Date().toISOString() } : {}),
      fee_note: fee_note ?? null,
      details: detailRows,
      instructions_md: instructions_md ?? null,
    };
    const { error } = methodId ? await supabase.from("payment_methods").update(row).eq("id", methodId) : await supabase.from("payment_methods").insert(row);
    if (error) throwSaveError(error, "name", "Another method already has that name.");
    bust();
    return { saved: true as const };
  },
});

/** Upload (or replace) the QR code shown on a method's payment page. Images only; the file's real type is checked, not its name. */
export const uploadMethodQr = formAction({
  name: "admin-method-qr",
  auth: "admin",
  rateLimit: { limit: 60, window: "1 h" },
  schema: z.object({
    id: uuid,
    file: z.instanceof(File, { error: "Choose an image." }),
  }),
  async handler({ id: methodId, file }, { supabase }) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const checked = checkUpload(bytes);
    if (!checked || checked.mime === "application/pdf" || checked.size > 1024 * 1024) {
      throw new AppError("VALIDATION", undefined, { fieldErrors: { file: ["Use a PNG, JPG or WebP image under 1 MB."] } });
    }
    const path = `${methodId}/${crypto.randomUUID()}.${checked.ext}`;
    const up = await supabase.storage.from("method-qr").upload(path, bytes, { contentType: checked.mime, upsert: false });
    if (up.error) throw new AppError("INTERNAL", undefined, { cause: up.error });
    const { error } = await supabase.from("payment_methods").update({ qr_path: path }).eq("id", methodId);
    if (error) throw fromDbError(error);
    revalidatePath("/admin/payment-methods");
    return { uploaded: true as const };
  },
});

export const setPaymentMethodActive = action({
  name: "admin-toggle-payment-method",
  auth: "admin",
  rateLimit: { limit: 200, window: "1 h" },
  schema: z.object({ id: uuid, active: z.boolean() }),
  async handler({ id: methodId, active }, { supabase }) {
    const { error } = await supabase.from("payment_methods").update({ is_active: active }).eq("id", methodId);
    if (error) throw fromDbError(error);
    bust();
    return { active };
  },
});

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------
export const saveCoupon = action({
  name: "admin-save-coupon",
  auth: "admin",
  rateLimit: { limit: 120, window: "1 h" },
  schema: z.object({
    id,
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/, "3–32 letters, numbers, hyphens or underscores."),
    type: z.enum(["percent", "fixed_usd"], { error: "Choose a type." }),
    value: z.string().trim().min(1, "Enter a value."),
    applies_product: z.union([z.literal(""), z.enum(["rdp", "vps"])]).default(""),
    min_order: z.string().trim().default(""),
    max_redemptions: z.string().trim().default(""),
    per_user_limit: z.string().trim().default(""),
    starts_at: z.union([z.literal(""), z.iso.datetime({ offset: true })]).default(""),
    ends_at: z.union([z.literal(""), z.iso.datetime({ offset: true })]).default(""),
    is_active: flag,
  }),
  async handler({ id: couponId, value, min_order, max_redemptions, per_user_limit, applies_product, starts_at, ends_at, ...v }, { supabase }) {
    const bad = (field: string, message: string) => new AppError("VALIDATION", undefined, { fieldErrors: { [field]: [message] } });
    let stored: number;
    if (v.type === "percent") {
      stored = Number(value);
      if (!Number.isInteger(stored) || stored < 1 || stored > 100) throw bad("value", "Use a whole percentage from 1 to 100.");
    } else {
      const cents = parseUsdToCents(value);
      if (cents === null || cents <= 0) throw bad("value", "Enter an amount like 5.00.");
      stored = cents;
    }
    const minCents = min_order ? parseUsdToCents(min_order) : 0;
    if (minCents === null) throw bad("min_order", "Enter an amount like 20.00, or leave empty.");
    const toInt = (s: string, field: string) => {
      if (!s) return null;
      const n = Number(s);
      if (!Number.isInteger(n) || n < 1) throw bad(field, "Use a whole number of 1 or more, or leave empty.");
      return n;
    };
    if (starts_at && ends_at && Date.parse(ends_at) <= Date.parse(starts_at)) throw bad("ends_at", "The end must be after the start.");

    const row = {
      ...v,
      value: stored,
      applies_product: applies_product || null,
      min_order_cents: minCents,
      max_redemptions: toInt(max_redemptions, "max_redemptions"),
      per_user_limit: toInt(per_user_limit, "per_user_limit"),
      starts_at: starts_at || null,
      ends_at: ends_at || null,
    };
    const { error } = couponId ? await supabase.from("coupons").update(row).eq("id", couponId) : await supabase.from("coupons").insert(row);
    if (error) throwSaveError(error, "code", "That code already exists.");
    revalidatePath("/admin/coupons");
    return { saved: true as const };
  },
});
