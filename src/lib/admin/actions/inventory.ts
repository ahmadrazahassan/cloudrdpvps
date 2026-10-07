"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/action";
import { AppError, fromDbError } from "@/lib/errors";
import { encryptCredential } from "@/lib/security/credentials";
import { optionalText, uuid } from "@/lib/validation";
import { parseCsv } from "../csv";
import { parseUsdToCents } from "../money";
import { throwSaveError } from "../save-error";

const ipSchema = z.union([z.ipv4("Enter a valid IPv4 or IPv6 address."), z.ipv6("Enter a valid IPv4 or IPv6 address.")]);
const refresh = () => revalidatePath("/admin/inventory");

export const addInventoryItem = action({
  name: "admin-add-inventory",
  auth: "admin",
  rateLimit: { limit: 200, window: "1 h" },
  schema: z.object({
    product: z.enum(["rdp", "vps"], { error: "Choose RDP or VPS." }),
    location_id: uuid,
    plan_id: z.union([z.literal(""), uuid]).default(""),
    ip: ipSchema,
    rdp_port: z.coerce.number().int().min(1).max(65535).default(3389),
    username: z.string().trim().min(1, "Enter the Windows username.").max(104),
    password: z.string().min(8, "Use at least 8 characters.").max(128),
    supplier: optionalText(80),
    supplier_ref: optionalText(120),
    cost: z.string().trim().default(""),
    supplier_expires_at: z.union([z.literal(""), z.iso.date()]).default(""),
    notes: optionalText(500),
  }),
  async handler({ password, cost, plan_id, supplier_expires_at, supplier, supplier_ref, notes, ...v }, { supabase }) {
    const cents = cost ? parseUsdToCents(cost) : null;
    if (cost && cents === null) throw new AppError("VALIDATION", undefined, { fieldErrors: { cost: ["Enter an amount like 12.00, or leave empty."] } });
    const { error } = await supabase.from("inventory_items").insert({
      ...v,
      plan_id: plan_id || null,
      password_enc: encryptCredential(password),
      supplier: supplier ?? null,
      supplier_ref: supplier_ref ?? null,
      supplier_cost_cents: cents,
      supplier_expires_at: supplier_expires_at || null,
      notes: notes ?? null,
    });
    if (error) throwSaveError(error, "ip", "That IP address is already in stock.");
    refresh();
    return { saved: true as const };
  },
});

export const retireInventoryItem = action({
  name: "admin-retire-inventory",
  auth: "admin",
  rateLimit: { limit: 200, window: "1 h" },
  schema: z.object({ id: uuid }),
  async handler({ id }, { supabase }) {
    const { data, error } = await supabase.from("inventory_items").update({ status: "retired" }).eq("id", id).eq("status", "available").select("id");
    if (error) throw fromDbError(error);
    if (!data?.length) throw new AppError("CONFLICT");
    refresh();
    return { retired: true as const };
  },
});

const HEADER = ["product", "location", "ip", "port", "username", "password", "supplier", "supplier_ref", "cost_usd", "supplier_expires"] as const;

/**
 * Bulk add from pasted CSV. `commit: false` only checks (and reports problems per line); `commit: true`
 * inserts the valid rows. Duplicates (an IP already in stock, or repeated in the paste) are skipped, never overwritten.
 * Columns: product, location (the location's slug), ip, port, username, password, supplier, supplier_ref, cost_usd, supplier_expires.
 */
export const importInventory = action({
  name: "admin-import-inventory",
  auth: "admin",
  rateLimit: { limit: 30, window: "1 h" },
  schema: z.object({ csv: z.string().min(1, "Paste your CSV first.").max(200_000, "That's too large — import it in smaller batches."), commit: z.boolean() }),
  async handler({ csv, commit }, { supabase }) {
    const rows = parseCsv(csv);
    if (rows.length < 2) throw new AppError("VALIDATION", undefined, { fieldErrors: { csv: ["Include a header row and at least one server."] } });
    const header = rows[0]!.map((h) => h.toLowerCase());
    const col = Object.fromEntries(HEADER.map((h) => [h, header.indexOf(h)])) as Record<(typeof HEADER)[number], number>;
    const missing = (["product", "location", "ip", "username", "password"] as const).filter((h) => col[h] === -1);
    if (missing.length) throw new AppError("VALIDATION", undefined, { fieldErrors: { csv: [`Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`] } });
    if (rows.length > 501) throw new AppError("VALIDATION", undefined, { fieldErrors: { csv: ["Import up to 500 servers at a time."] } });

    const locations = await supabase.from("locations").select("id, slug");
    if (locations.error) throw fromDbError(locations.error);
    const locBySlug = new Map((locations.data ?? []).map((l) => [l.slug, l.id]));
    const existing = await supabase.from("inventory_items").select("ip");
    if (existing.error) throw fromDbError(existing.error);
    const taken = new Set((existing.data ?? []).map((r) => String(r.ip).split("/")[0]));

    const problems: { line: number; message: string }[] = [];
    const ready: Record<string, unknown>[] = [];
    const seen = new Set<string>();

    rows.slice(1).forEach((r, i) => {
      const line = i + 2;
      const get = (k: (typeof HEADER)[number]) => (col[k] >= 0 ? (r[col[k]] ?? "") : "");
      const fail = (message: string) => problems.push({ line, message });
      const product = get("product").toLowerCase();
      if (product !== "rdp" && product !== "vps") return fail(`Product must be rdp or vps (got “${get("product")}”).`);
      const loc = locBySlug.get(get("location").toLowerCase());
      if (!loc) return fail(`Unknown location “${get("location")}” — use the location's slug, e.g. germany.`);
      const ip = get("ip");
      if (!ipSchema.safeParse(ip).success) return fail(`“${ip}” isn't a valid IP address.`);
      if (taken.has(ip) || seen.has(ip)) return fail(`${ip} is already in stock — skipped.`);
      const port = get("port") ? Number(get("port")) : 3389;
      if (!Number.isInteger(port) || port < 1 || port > 65535) return fail(`Port “${get("port")}” isn't valid.`);
      if (!get("username")) return fail("Username is empty.");
      if (get("password").length < 8) return fail("Password must be at least 8 characters.");
      const cents = get("cost_usd") ? parseUsdToCents(get("cost_usd")) : null;
      if (get("cost_usd") && cents === null) return fail(`Cost “${get("cost_usd")}” isn't an amount like 12.00.`);
      const exp = get("supplier_expires");
      if (exp && !z.iso.date().safeParse(exp).success) return fail(`Supplier expiry “${exp}” must look like 2026-12-31.`);
      seen.add(ip);
      ready.push({
        product,
        location_id: loc,
        ip,
        rdp_port: port,
        username: get("username"),
        password_enc: commit ? encryptCredential(get("password")) : "preview",
        supplier: get("supplier") || null,
        supplier_ref: get("supplier_ref") || null,
        supplier_cost_cents: cents,
        supplier_expires_at: exp || null,
      });
    });

    if (!commit) return { checked: true as const, valid: ready.length, problems };
    if (problems.some((p) => !/already in stock/.test(p.message))) {
      throw new AppError("VALIDATION", undefined, { fieldErrors: { csv: ["Fix the highlighted lines first, then import again."] } });
    }
    if (ready.length === 0) throw new AppError("VALIDATION", undefined, { fieldErrors: { csv: ["There is nothing new to import."] } });
    const { error } = await supabase.from("inventory_items").insert(ready as never);
    if (error) throw fromDbError(error);
    refresh();
    return { checked: false as const, imported: ready.length, problems };
  },
});
