import "server-only";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/database";
import { db, ok, pageCount, pageRange, profilesById } from "./db";
import { INVENTORY_COLS, type InventoryItem } from "./queries";

/** Catalog, content, team, audit, inventory and settings reads for the console's system pages. */

export type Plan = Tables<"plans">;
export type Location = Tables<"locations">;
export type PlanPricing = Tables<"plan_pricing">;
export type PaymentMethod = Tables<"payment_methods">;
export type Coupon = Tables<"coupons">;
export type Faq = Tables<"faqs">;
export type AuditLog = Tables<"audit_logs">;

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
export async function getCatalogAdmin() {
  const supabase = await db();
  const [plans, locations, pricing] = await Promise.all([
    supabase.from("plans").select("*").order("product", { ascending: true }).order("sort_order", { ascending: true }),
    supabase.from("locations").select("*").order("sort_order", { ascending: true }),
    supabase.from("plan_pricing").select("*"),
  ]);
  return { plans: ok(plans, [] as Plan[]), locations: ok(locations, [] as Location[]), pricing: ok(pricing, [] as PlanPricing[]) };
}

// ---------------------------------------------------------------------------
// Payment methods (with 30-day usage)
// ---------------------------------------------------------------------------
export async function getPaymentMethodsAdmin(nowMs: number) {
  const supabase = await db();
  const since = new Date(nowMs - 30 * 86_400_000).toISOString();
  const [methods, payments] = await Promise.all([
    supabase.from("payment_methods").select("*").order("sort_order", { ascending: true }),
    supabase.from("payments").select("method_id, amount_usd_cents, status").eq("status", "verified").gte("created_at", since).limit(5000),
  ]);
  const usage = new Map<string, { count: number; cents: number }>();
  for (const p of ok(payments, [] as { method_id: string; amount_usd_cents: number; status: string }[])) {
    const u = usage.get(p.method_id) ?? { count: 0, cents: 0 };
    u.count += 1;
    u.cents += p.amount_usd_cents;
    usage.set(p.method_id, u);
  }
  return ok(methods, [] as PaymentMethod[]).map((m) => ({ method: m, usage: usage.get(m.id) ?? { count: 0, cents: 0 } }));
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------
export async function getCouponsAdmin() {
  const supabase = await db();
  return ok(await supabase.from("coupons").select("*").order("created_at", { ascending: false }), [] as Coupon[]);
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------
export async function getFaqsAdmin() {
  const supabase = await db();
  return ok(await supabase.from("faqs").select("*").order("category", { ascending: true }).order("sort_order", { ascending: true }), [] as Faq[]);
}

export interface AnnouncementValue {
  enabled: boolean;
  text: string;
  link: string;
  tone: "info" | "warn";
  starts_at: string | null;
  ends_at: string | null;
}

export async function getSettingsMap(): Promise<Record<string, unknown>> {
  const supabase = await db();
  const rows = ok(await supabase.from("site_settings").select("key, value"), [] as { key: string; value: unknown }[]);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function parseAnnouncement(v: unknown): AnnouncementValue {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    enabled: o.enabled === true,
    text: typeof o.text === "string" ? o.text : "",
    link: typeof o.link === "string" ? o.link : "",
    tone: o.tone === "warn" ? "warn" : "info",
    starts_at: typeof o.starts_at === "string" ? o.starts_at : null,
    ends_at: typeof o.ends_at === "string" ? o.ends_at : null,
  };
}

export async function getCannedAdmin() {
  const supabase = await db();
  return ok(await supabase.from("canned_responses").select("*").order("title", { ascending: true }), [] as Tables<"canned_responses">[]);
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------
export async function getTeam() {
  const supabase = await db();
  return ok(
    await supabase.from("profiles").select("*").in("role", ["support", "admin"]).order("role", { ascending: true }).order("created_at", { ascending: true }),
    [] as Tables<"profiles">[],
  );
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
export interface AuditFilters {
  action?: string;
  entity?: string;
  actor?: string;
  from?: string;
  to?: string;
  page: number;
}
export const AUDIT_PAGE = 50;

export async function getAuditLog(f: AuditFilters) {
  const supabase = await db();
  let q = supabase.from("audit_logs").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (f.action) q = q.ilike("action", `${f.action.replace(/[%_\\]/g, "")}%`);
  if (f.entity) q = q.eq("entity_type", f.entity);
  if (f.actor) q = q.eq("actor_id", f.actor);
  if (f.from) q = q.gte("created_at", f.from);
  if (f.to) q = q.lt("created_at", f.to);
  const [from, to] = pageRange(f.page, AUDIT_PAGE);
  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error("audit");
  const rows = data ?? [];
  const people = await profilesById(rows.map((r) => r.actor_id));
  return { items: rows.map((r) => ({ event: r, actor: r.actor_id ? (people.get(r.actor_id) ?? null) : null })), total: count ?? 0, page: f.page, pageCount: pageCount(count ?? 0, AUDIT_PAGE) };
}

export async function getAuditFilterOptions() {
  const supabase = await db();
  const [actions, staff] = await Promise.all([
    supabase.from("audit_logs").select("action").order("created_at", { ascending: false }).limit(1000),
    supabase.from("profiles").select("id, email, full_name").in("role", ["support", "admin"]),
  ]);
  const verbs = [...new Set(ok(actions, [] as { action: string }[]).map((a) => a.action))].sort();
  return { actions: verbs, staff: ok(staff, [] as { id: string; email: string; full_name: string }[]) };
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------
export async function getInventory(opts: { status?: "available" | "allocated" | "retired"; product?: "rdp" | "vps"; page: number }) {
  const supabase = await db();
  let q = supabase.from("inventory_items").select(INVENTORY_COLS, { count: "exact" }).order("created_at", { ascending: false });
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.product) q = q.eq("product", opts.product);
  const [from, to] = pageRange(opts.page);
  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error("inventory");
  return { items: (data ?? []) as unknown as InventoryItem[], total: count ?? 0, page: opts.page, pageCount: pageCount(count ?? 0) };
}

/** Available stock grouped by product + location, to flag what is running low. */
export async function getStockLevels() {
  const supabase = await db();
  const rows = ok(await supabase.from("inventory_items").select("product, location_id").eq("status", "available").limit(5000), [] as { product: "rdp" | "vps"; location_id: string }[]);
  const map = new Map<string, number>();
  for (const r of rows) map.set(`${r.product}:${r.location_id}`, (map.get(`${r.product}:${r.location_id}`) ?? 0) + 1);
  return map;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
export async function getReportData(fromIso: string, toIso: string) {
  const supabase = await db();
  const [orders, invoices, payments, customers, tickets, refunds] = await Promise.all([
    supabase.from("orders").select("id, order_number, product, plan_name, location_name, type, status, total_cents, discount_cents, created_at, completed_at").gte("created_at", fromIso).lt("created_at", toIso).limit(10000),
    supabase.from("invoices").select("id, order_id, total_cents, discount_cents, status, issued_at").gte("issued_at", fromIso).lt("issued_at", toIso).limit(10000),
    supabase.from("payments").select("order_id, method_name, status, amount_usd_cents, created_at").gte("created_at", fromIso).lt("created_at", toIso).limit(10000),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer").gte("created_at", fromIso).lt("created_at", toIso),
    supabase.from("tickets").select("id, created_at, last_staff_message_at").gte("created_at", fromIso).lt("created_at", toIso).limit(5000),
    supabase.from("order_events").select("order_id, data, created_at").eq("event", "refunded").gte("created_at", fromIso).lt("created_at", toIso).limit(5000),
  ]);
  return {
    refunds: ok(refunds, [] as { order_id: string; data: unknown; created_at: string }[]),
    orders: ok(orders, [] as ReportOrder[]),
    invoices: ok(invoices, [] as ReportInvoice[]),
    payments: ok(payments, [] as { order_id: string; method_name: string; status: string; amount_usd_cents: number; created_at: string }[]),
    newCustomers: customers.count ?? 0,
    tickets: ok(tickets, [] as { id: string; created_at: string; last_staff_message_at: string | null }[]),
  };
}

export interface ReportOrder {
  id: string;
  order_number: string;
  product: "rdp" | "vps";
  plan_name: string;
  location_name: string;
  type: "new" | "renewal";
  status: string;
  total_cents: number;
  discount_cents: number;
  created_at: string;
  completed_at: string | null;
}
export interface ReportInvoice {
  id: string;
  order_id: string;
  total_cents: number;
  discount_cents: number;
  status: string;
  issued_at: string;
}

// ---------------------------------------------------------------------------
// Staff MFA status (needs the service role: factors live in the auth schema)
// ---------------------------------------------------------------------------
/** true = has a verified authenticator, false = none, missing = unknown (service key not configured or lookup failed). */
export async function getStaffMfa(ids: string[]): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  if (!serverEnv().SUPABASE_SERVICE_ROLE_KEY) return out;
  const admin = createAdminClient();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const r = await admin.auth.admin.mfa.listFactors({ userId: id });
        if (!r.error) out.set(id, (r.data?.factors ?? []).some((f) => f.status === "verified"));
      } catch {
        /* leave unknown */
      }
    }),
  );
  return out;
}
