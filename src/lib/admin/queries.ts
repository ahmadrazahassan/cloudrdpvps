import "server-only";
import { cache } from "react";
import type { Enums, Tables } from "@/types/database";
import { ADMIN_PAGE, cleanSearch, db, jsonNumber, ok, pageCount, pageRange, profilesById, searchFilter, type ProfileLite } from "./db";

export type Order = Tables<"orders">;
export type Payment = Tables<"payments">;
export type Service = Tables<"services">;
export type Invoice = Tables<"invoices">;
export type Ticket = Tables<"tickets">;
export type TicketMessage = Tables<"ticket_messages">;
export type Profile = Tables<"profiles">;
export type ContactMessage = Tables<"contact_messages">;

/** inventory_items.password_enc is not selectable by clients (column grants), so never `select("*")` that table. */
export const INVENTORY_COLS =
  "id, product, location_id, plan_id, ip, rdp_port, username, supplier, supplier_ref, supplier_cost_cents, supplier_expires_at, status, allocated_service_id, notes, created_at, updated_at";
export type InventoryItem = Omit<Tables<"inventory_items">, "password_enc">;

// ---------------------------------------------------------------------------
// Action queue (sidebar badges, ribbon, overview)
// ---------------------------------------------------------------------------
export interface ActionQueue {
  paymentsToReview: number;
  oldestPendingPaymentAt: string | null;
  ordersToAllocate: number;
  expiring3d: number;
  ticketsAwaitingStaff: number;
  unreadInbox: number;
}

const EMPTY_QUEUE: ActionQueue = {
  paymentsToReview: 0,
  oldestPendingPaymentAt: null,
  ordersToAllocate: 0,
  expiring3d: 0,
  ticketsAwaitingStaff: 0,
  unreadInbox: 0,
};

export const getActionQueue = cache(async (): Promise<ActionQueue> => {
  const supabase = await db();
  const { data, error } = await supabase.rpc("admin_action_queue");
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return EMPTY_QUEUE; // a failing badge must never break the console
  const q = data as Record<string, unknown>;
  const n = (k: string) => Number(q[k] ?? 0) || 0;
  return {
    paymentsToReview: n("payments_to_review"),
    oldestPendingPaymentAt: typeof q.oldest_pending_payment_at === "string" ? q.oldest_pending_payment_at : null,
    ordersToAllocate: n("orders_to_allocate"),
    expiring3d: n("expiring_3d"),
    ticketsAwaitingStaff: n("tickets_awaiting_staff"),
    unreadInbox: n("unread_inbox"),
  };
});

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
export type RangeKey = "today" | "7d" | "30d" | "90d";
export const RANGES: { id: RangeKey; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];
export const isRange = (v: string | undefined): v is RangeKey => RANGES.some((r) => r.id === v);

const DAY = 86_400_000;

/** [from, to) for the range, and the equally long period right before it. */
export function rangeBounds(range: RangeKey, nowMs: number) {
  const startOfToday = Math.floor(nowMs / DAY) * DAY;
  const days = range === "today" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const from = startOfToday - (days - 1) * DAY;
  const to = startOfToday + DAY;
  const span = to - from;
  return {
    days,
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    prevFrom: new Date(from - span).toISOString(),
    prevTo: new Date(from).toISOString(),
  };
}

export interface Kpis {
  revenueCents: number;
  orders: number;
  newCustomers: number;
  activeServices: number;
  renewals: number;
  newOrdersCompleted: number;
}

function parseKpis(v: unknown): Kpis {
  const n = (k: string) => jsonNumber(v, k) ?? 0;
  return {
    revenueCents: n("revenue_cents"),
    orders: n("orders"),
    newCustomers: n("new_customers"),
    activeServices: n("active_services"),
    renewals: n("renewals"),
    newOrdersCompleted: n("new_orders_completed"),
  };
}

export interface Tally {
  label: string;
  count: number;
}
const tally = (values: string[]): Tally[] => {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
};

/** Money figures and charts — admin only (the RPCs refuse support). */
export async function getOverviewMoney(range: RangeKey, nowMs: number) {
  const supabase = await db();
  const b = rangeBounds(range, nowMs);
  const [cur, prev, series, orders, payments] = await Promise.all([
    supabase.rpc("admin_kpis", { p_from: b.from, p_to: b.to }),
    supabase.rpc("admin_kpis", { p_from: b.prevFrom, p_to: b.prevTo }),
    supabase.rpc("admin_revenue_series", { p_from: b.from, p_to: b.to, p_bucket: "day" }),
    supabase.from("orders").select("location_name, product").gte("created_at", b.from).lt("created_at", b.to).limit(5000),
    supabase.from("payments").select("method_name").eq("status", "verified").gte("created_at", b.from).lt("created_at", b.to).limit(5000),
  ]);
  if (cur.error) throw new Error("kpis");
  const daily = new Map<string, number>();
  for (const row of series.data ?? []) {
    if (row.bucket) daily.set(row.bucket.slice(0, 10), Number(row.revenue_cents ?? 0));
  }
  // one point per calendar day, zero-filled, so the chart always has the same rhythm
  const points: { day: string; cents: number }[] = [];
  const start = Date.parse(b.from);
  for (let i = 0; i < b.days; i++) {
    const day = new Date(start + i * DAY).toISOString().slice(0, 10);
    points.push({ day, cents: daily.get(day) ?? 0 });
  }
  const orderRows = ok(orders, [] as { location_name: string; product: Enums<"product_type"> }[]);
  return {
    range: b,
    kpis: parseKpis(cur.data),
    previous: parseKpis(prev.data),
    points,
    byCountry: tally(orderRows.map((o) => o.location_name)).slice(0, 6),
    byProduct: tally(orderRows.map((o) => o.product.toUpperCase())),
    byMethod: tally(ok(payments, [] as { method_name: string }[]).map((p) => p.method_name)).slice(0, 6),
  };
}

/** Oldest unreviewed payments and services about to expire — both roles. */
export async function getWorkLists(nowMs: number) {
  const supabase = await db();
  const soon = new Date(nowMs + 3 * DAY).toISOString();
  const [payments, expiring] = await Promise.all([
    supabase.from("payments").select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(6),
    supabase
      .from("services")
      .select("*")
      .eq("status", "active")
      .gte("expires_at", new Date(nowMs).toISOString())
      .lte("expires_at", soon)
      .order("expires_at", { ascending: true })
      .limit(6),
  ]);
  const pay = ok(payments, [] as Payment[]);
  const svc = ok(expiring, [] as Service[]);
  const orderIds = pay.map((p) => p.order_id);
  const orders = orderIds.length
    ? ok(await supabase.from("orders").select("id, order_number, plan_name, location_name").in("id", orderIds), [] as Pick<Order, "id" | "order_number" | "plan_name" | "location_name">[])
    : [];
  const people = await profilesById([...pay.map((p) => p.user_id), ...svc.map((s) => s.user_id)]);
  return {
    payments: pay.map((p) => ({ payment: p, order: orders.find((o) => o.id === p.order_id) ?? null, customer: people.get(p.user_id) ?? null })),
    expiring: svc.map((s) => ({ service: s, customer: people.get(s.user_id) ?? null })),
  };
}

/** Last audit events (admin only — RLS hides the table from support). */
export async function getRecentActivity(limit = 12) {
  const supabase = await db();
  const rows = ok(await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit), [] as Tables<"audit_logs">[]);
  const people = await profilesById(rows.map((r) => r.actor_id));
  return rows.map((r) => ({ event: r, actor: r.actor_id ? (people.get(r.actor_id) ?? null) : null }));
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export type PaymentTab = "pending" | "verified" | "rejected" | "all";
export const PAYMENT_TABS: { id: PaymentTab; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "verified", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];
export const isPaymentTab = (v: string | undefined): v is PaymentTab => PAYMENT_TABS.some((t) => t.id === v);

export async function listPaymentQueue(tab: PaymentTab, page: number) {
  const supabase = await db();
  let q = supabase.from("payments").select("*", { count: "exact" });
  if (tab !== "all") q = q.eq("status", tab);
  // The queue works oldest-first (the longest wait is the most urgent); history reads newest-first.
  q = q.order("created_at", { ascending: tab === "pending" });
  const [from, to] = pageRange(page, 30);
  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error("payments");
  const rows = data ?? [];
  const orders = rows.length
    ? ok(await supabase.from("orders").select("id, order_number, plan_name, location_name, type, total_cents").in("id", rows.map((r) => r.order_id)), [] as Pick<Order, "id" | "order_number" | "plan_name" | "location_name" | "type" | "total_cents">[])
    : [];
  const people = await profilesById(rows.map((r) => r.user_id));
  // duplicate evidence: another payment with the same proof hash
  const hashes = [...new Set(rows.map((r) => r.proof_sha256))];
  const dupRows = hashes.length
    ? ok(await supabase.from("payments").select("id, proof_sha256").in("proof_sha256", hashes), [] as Pick<Payment, "id" | "proof_sha256">[])
    : [];
  const dupCount = new Map<string, number>();
  for (const d of dupRows) dupCount.set(d.proof_sha256, (dupCount.get(d.proof_sha256) ?? 0) + 1);

  const counts = await Promise.all(
    (["pending", "verified", "rejected"] as const).map(async (s) => {
      const r = await supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", s);
      return [s, r.count ?? 0] as const;
    }),
  );
  const byStatus = Object.fromEntries(counts) as Record<"pending" | "verified" | "rejected", number>;
  return {
    items: rows.map((p) => ({
      payment: p,
      order: orders.find((o) => o.id === p.order_id) ?? null,
      customer: people.get(p.user_id) ?? null,
      duplicate: (dupCount.get(p.proof_sha256) ?? 0) > 1,
    })),
    total: count ?? 0,
    page,
    pageCount: pageCount(count ?? 0, 30),
    counts: { ...byStatus, all: byStatus.pending + byStatus.verified + byStatus.rejected },
  };
}

export async function getPaymentDetail(id: string) {
  const supabase = await db();
  const payment = ok(await supabase.from("payments").select("*").eq("id", id).maybeSingle(), null as Payment | null);
  if (!payment) return null;
  const [order, method, dupHash, dupRef, siblings] = await Promise.all([
    supabase.from("orders").select("*").eq("id", payment.order_id).maybeSingle(),
    supabase.from("payment_methods").select("id, name, currency_code, rate_per_usd, type").eq("id", payment.method_id).maybeSingle(),
    supabase.from("payments").select("id, order_id, status, created_at").eq("proof_sha256", payment.proof_sha256).neq("id", payment.id).limit(5),
    payment.reference
      ? supabase.from("payments").select("id, order_id, status, created_at").eq("reference", payment.reference).eq("method_id", payment.method_id).neq("id", payment.id).limit(5)
      : Promise.resolve({ data: [] as Pick<Payment, "id" | "order_id" | "status" | "created_at">[], error: null }),
    supabase.from("payments").select("id, status, created_at, amount_usd_cents, reject_reason").eq("order_id", payment.order_id).neq("id", payment.id).order("created_at", { ascending: false }),
  ]);
  const o = ok(order, null as Order | null);
  const people = await profilesById([payment.user_id]);

  // For a renewal the approval extends the linked service: preview what changes.
  let renewal: { service: Service; from: string; to: string } | null = null;
  if (o?.type === "renewal" && o.service_id) {
    const svc = ok(await supabase.from("services").select("*").eq("id", o.service_id).maybeSingle(), null as Service | null);
    if (svc) {
      const base = Math.max(Date.now(), Date.parse(svc.expires_at));
      renewal = { service: svc, from: svc.expires_at, to: new Date(base + o.term_days * DAY).toISOString() };
    }
  }
  const dupIds = new Map<string, Pick<Payment, "id" | "order_id" | "status" | "created_at">>();
  for (const d of [...(dupHash.data ?? []), ...(dupRef.data ?? [])]) dupIds.set(d.id, d);
  const dupOrders = dupIds.size
    ? ok(await supabase.from("orders").select("id, order_number").in("id", [...dupIds.values()].map((d) => d.order_id)), [] as Pick<Order, "id" | "order_number">[])
    : [];
  return {
    payment,
    order: o,
    customer: people.get(payment.user_id) ?? null,
    method: ok(method, null as { id: string; name: string; currency_code: string | null; rate_per_usd: number | null; type: string } | null),
    duplicates: [...dupIds.values()].map((d) => ({ ...d, order_number: dupOrders.find((x) => x.id === d.order_id)?.order_number ?? "another order" })),
    siblings: ok(siblings, [] as Pick<Payment, "id" | "status" | "created_at" | "amount_usd_cents" | "reject_reason">[]),
    renewal,
  };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export interface OrderFilters {
  status?: Enums<"order_status">;
  type?: Enums<"order_type">;
  product?: Enums<"product_type">;
  q?: string;
  page: number;
  /** "mine" is not stored; "unassigned" filters on assigned_to is null. */
  assigned?: "unassigned";
  /** New orders that are paid and waiting for a server (approved or being set up). */
  allocate?: boolean;
}

const idsMatchingCustomer = async (q: string): Promise<string[]> => {
  const filter = searchFilter(["email", "full_name"], q);
  if (!filter) return [];
  const supabase = await db();
  const rows = ok(await supabase.from("profiles").select("id").or(filter).limit(50), [] as { id: string }[]);
  return rows.map((r) => r.id);
};

export async function listOrders(f: OrderFilters) {
  const supabase = await db();
  let q = supabase.from("orders").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (f.status) q = q.eq("status", f.status);
  if (f.type) q = q.eq("type", f.type);
  if (f.product) q = q.eq("product", f.product);
  if (f.assigned === "unassigned") q = q.is("assigned_to", null);
  if (f.allocate) q = q.eq("type", "new").in("status", ["approved", "provisioning"]);
  const term = cleanSearch(f.q);
  if (term) {
    const ids = await idsMatchingCustomer(term);
    const parts = [`order_number.ilike.%${term}%`, `plan_name.ilike.%${term}%`];
    if (ids.length) parts.push(`user_id.in.(${ids.join(",")})`);
    q = q.or(parts.join(","));
  }
  const [from, to] = pageRange(f.page);
  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error("orders");
  const rows = data ?? [];
  const people = await profilesById(rows.map((o) => o.user_id));
  const pays = rows.length
    ? ok(await supabase.from("payments").select("order_id, status, created_at").in("order_id", rows.map((o) => o.id)).order("created_at", { ascending: false }), [] as Pick<Payment, "order_id" | "status" | "created_at">[])
    : [];
  return {
    items: rows.map((o) => ({
      order: o,
      customer: people.get(o.user_id) ?? null,
      payment: pays.find((p) => p.order_id === o.id)?.status ?? null,
    })),
    total: count ?? 0,
    page: f.page,
    pageCount: pageCount(count ?? 0),
  };
}

export async function getOrderDetail(id: string, withInventory: boolean) {
  const supabase = await db();
  const order = ok(await supabase.from("orders").select("*").eq("id", id).maybeSingle(), null as Order | null);
  if (!order) return null;
  const [payments, events, services, invoices, notes, stock] = await Promise.all([
    supabase.from("payments").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("order_events").select("*").eq("order_id", id).order("created_at", { ascending: true }),
    supabase.from("services").select("*").or(`order_id.eq.${id},id.eq.${order.service_id ?? "00000000-0000-0000-0000-000000000000"}`),
    supabase.from("invoices").select("*").eq("order_id", id),
    supabase.from("staff_notes").select("*").eq("entity_type", "order").eq("entity_id", id).order("created_at", { ascending: false }),
    withInventory
      ? supabase
          .from("inventory_items")
          .select(INVENTORY_COLS)
          .eq("status", "available")
          .eq("location_id", order.location_id)
          .eq("product", order.product)
          .or(`plan_id.eq.${order.plan_id},plan_id.is.null`)
          .order("created_at", { ascending: true })
          .limit(30)
      : Promise.resolve({ data: [] as InventoryItem[], error: null }),
  ]);
  const noteRows = ok(notes, [] as Tables<"staff_notes">[]);
  const eventRows = ok(events, [] as Tables<"order_events">[]);
  const people = await profilesById([order.user_id, order.assigned_to, ...noteRows.map((n) => n.author_id), ...eventRows.map((e) => e.actor_id)]);
  return {
    order,
    customer: people.get(order.user_id) ?? null,
    people,
    payments: ok(payments, [] as Payment[]),
    events: eventRows,
    services: ok(services, [] as Service[]),
    invoices: ok(invoices, [] as Invoice[]),
    notes: noteRows,
    stock: ok(stock as { data: InventoryItem[] | null; error: null }, [] as InventoryItem[]),
  };
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------
export type ServiceView = "all" | "active" | "expiring" | "suspended" | "expired" | "terminated";
export const SERVICE_VIEWS: { id: ServiceView; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "expiring", label: "Expiring ≤ 7d" },
  { id: "expired", label: "Expired" },
  { id: "suspended", label: "Suspended" },
  { id: "terminated", label: "Terminated" },
];
export const isServiceView = (v: string | undefined): v is ServiceView => SERVICE_VIEWS.some((s) => s.id === v);

export async function listServices(opts: { view: ServiceView; product?: Enums<"product_type">; q?: string; page: number; nowMs: number }) {
  const supabase = await db();
  let q = supabase.from("services").select("*", { count: "exact" });
  const now = new Date(opts.nowMs).toISOString();
  switch (opts.view) {
    case "active":
      q = q.eq("status", "active");
      break;
    case "expiring":
      q = q.eq("status", "active").gte("expires_at", now).lte("expires_at", new Date(opts.nowMs + 7 * DAY).toISOString());
      break;
    case "expired":
      q = q.eq("status", "expired");
      break;
    case "suspended":
      q = q.eq("status", "suspended");
      break;
    case "terminated":
      q = q.eq("status", "terminated");
      break;
  }
  if (opts.product) q = q.eq("product", opts.product);
  const term = cleanSearch(opts.q);
  if (term) {
    const ids = await idsMatchingCustomer(term);
    const parts = [`label.ilike.%${term}%`, `hostname.ilike.%${term}%`];
    if (/^[0-9a-f:.]+$/i.test(term) && term.includes(".") && term.split(".").length === 4) parts.push(`ip.eq.${term}`);
    if (ids.length) parts.push(`user_id.in.(${ids.join(",")})`);
    q = q.or(parts.join(","));
  }
  q = q.order("expires_at", { ascending: true });
  const [from, to] = pageRange(opts.page);
  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error("services");
  const rows = data ?? [];
  const people = await profilesById(rows.map((s) => s.user_id));
  return {
    items: rows.map((s) => ({ service: s, customer: people.get(s.user_id) ?? null })),
    total: count ?? 0,
    page: opts.page,
    pageCount: pageCount(count ?? 0),
  };
}

export async function getServiceDetail(id: string, withAudit: boolean) {
  const supabase = await db();
  const service = ok(await supabase.from("services").select("*").eq("id", id).maybeSingle(), null as Service | null);
  if (!service) return null;
  const [orders, tickets, notes, audit, inventory] = await Promise.all([
    supabase.from("orders").select("*").or(`id.eq.${service.order_id},service_id.eq.${service.id}`).order("created_at", { ascending: false }),
    supabase.from("tickets").select("*").eq("service_id", id).order("last_message_at", { ascending: false }).limit(10),
    supabase.from("staff_notes").select("*").eq("entity_type", "service").eq("entity_id", id).order("created_at", { ascending: false }),
    withAudit
      ? supabase.from("audit_logs").select("*").eq("entity_type", "service").eq("entity_id", id).order("created_at", { ascending: false }).limit(25)
      : Promise.resolve({ data: [] as Tables<"audit_logs">[], error: null }),
    withAudit && service.inventory_item_id
      ? supabase.from("inventory_items").select(INVENTORY_COLS).eq("id", service.inventory_item_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const noteRows = ok(notes, [] as Tables<"staff_notes">[]);
  const auditRows = ok(audit as { data: Tables<"audit_logs">[] | null; error: null }, [] as Tables<"audit_logs">[]);
  const people = await profilesById([service.user_id, ...noteRows.map((n) => n.author_id), ...auditRows.map((a) => a.actor_id)]);
  return {
    service,
    customer: people.get(service.user_id) ?? null,
    people,
    orders: ok(orders, [] as Order[]),
    tickets: ok(tickets, [] as Ticket[]),
    notes: noteRows,
    audit: auditRows,
    inventory: ok(inventory as { data: InventoryItem | null; error: null }, null as InventoryItem | null),
  };
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
export type CustomerView = "all" | "active" | "suspended";

export async function listCustomers(opts: { view: CustomerView; q?: string; page: number }) {
  const supabase = await db();
  let q = supabase.from("profiles").select("*", { count: "exact" }).eq("role", "customer");
  if (opts.view !== "all") q = q.eq("status", opts.view);
  const filter = searchFilter(["email", "full_name", "phone"], opts.q);
  if (filter) q = q.or(filter);
  q = q.order("created_at", { ascending: false });
  const [from, to] = pageRange(opts.page);
  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error("customers");
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  const [orders, services] = ids.length
    ? await Promise.all([
        supabase.from("orders").select("user_id, total_cents, status").in("user_id", ids).limit(5000),
        supabase.from("services").select("user_id, status").in("user_id", ids).limit(5000),
      ])
    : [{ data: [] }, { data: [] }];
  const spend = new Map<string, number>();
  const orderCount = new Map<string, number>();
  for (const o of (orders.data ?? []) as Pick<Order, "user_id" | "total_cents" | "status">[]) {
    orderCount.set(o.user_id, (orderCount.get(o.user_id) ?? 0) + 1);
    if (o.status === "completed" || o.status === "approved" || o.status === "provisioning") spend.set(o.user_id, (spend.get(o.user_id) ?? 0) + o.total_cents);
  }
  const active = new Map<string, number>();
  for (const s of (services.data ?? []) as Pick<Service, "user_id" | "status">[]) {
    if (s.status === "active") active.set(s.user_id, (active.get(s.user_id) ?? 0) + 1);
  }
  return {
    items: rows.map((p) => ({ profile: p, orders: orderCount.get(p.id) ?? 0, active: active.get(p.id) ?? 0, spendCents: spend.get(p.id) ?? 0 })),
    total: count ?? 0,
    page: opts.page,
    pageCount: pageCount(count ?? 0),
  };
}

export async function getCustomerDetail(id: string) {
  const supabase = await db();
  const profile = ok(await supabase.from("profiles").select("*").eq("id", id).maybeSingle(), null as Profile | null);
  if (!profile) return null;
  const [orders, services, tickets, notes] = await Promise.all([
    supabase.from("orders").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("services").select("*").eq("user_id", id).order("expires_at", { ascending: true }).limit(100),
    supabase.from("tickets").select("*").eq("user_id", id).order("last_message_at", { ascending: false }).limit(50),
    supabase.from("staff_notes").select("*").eq("entity_type", "customer").eq("entity_id", id).order("created_at", { ascending: false }),
  ]);
  const noteRows = ok(notes, [] as Tables<"staff_notes">[]);
  const people = await profilesById(noteRows.map((n) => n.author_id));
  return {
    profile,
    orders: ok(orders, [] as Order[]),
    services: ok(services, [] as Service[]),
    tickets: ok(tickets, [] as Ticket[]),
    notes: noteRows,
    people,
  };
}

// ---------------------------------------------------------------------------
// Tickets & inbox
// ---------------------------------------------------------------------------
export type TicketView = "awaiting" | "mine" | "unassigned" | "waiting" | "resolved" | "all";
export const TICKET_VIEWS: { id: TicketView; label: string }[] = [
  { id: "awaiting", label: "Needs reply" },
  { id: "mine", label: "Mine" },
  { id: "unassigned", label: "Unassigned" },
  { id: "waiting", label: "Waiting on customer" },
  { id: "resolved", label: "Resolved & closed" },
  { id: "all", label: "All" },
];
export const isTicketView = (v: string | undefined): v is TicketView => TICKET_VIEWS.some((t) => t.id === v);

export async function listTickets(opts: { view: TicketView; me: string; priority?: Enums<"ticket_priority">; q?: string; page: number }) {
  const supabase = await db();
  let q = supabase.from("tickets").select("*", { count: "exact" });
  switch (opts.view) {
    case "awaiting":
      q = q.eq("status", "open");
      break;
    case "mine":
      q = q.eq("assigned_to", opts.me).in("status", ["open", "awaiting_customer"]);
      break;
    case "unassigned":
      q = q.is("assigned_to", null).in("status", ["open", "awaiting_customer"]);
      break;
    case "waiting":
      q = q.eq("status", "awaiting_customer");
      break;
    case "resolved":
      q = q.in("status", ["resolved", "closed"]);
      break;
  }
  if (opts.priority) q = q.eq("priority", opts.priority);
  const term = cleanSearch(opts.q);
  if (term) {
    const ids = await idsMatchingCustomer(term);
    const parts = [`subject.ilike.%${term}%`];
    if (/^\d{1,9}$/.test(term)) parts.push(`ticket_no.eq.${term}`);
    if (ids.length) parts.push(`user_id.in.(${ids.join(",")})`);
    q = q.or(parts.join(","));
  }
  // urgent first, then the longest-waiting
  q = q.order("priority", { ascending: false }).order("last_message_at", { ascending: true });
  const [from, to] = pageRange(opts.page);
  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error("tickets");
  const rows = data ?? [];
  const people = await profilesById([...rows.map((t) => t.user_id), ...rows.map((t) => t.assigned_to)]);
  return {
    items: rows.map((t) => ({ ticket: t, customer: people.get(t.user_id) ?? null, assignee: t.assigned_to ? (people.get(t.assigned_to) ?? null) : null })),
    total: count ?? 0,
    page: opts.page,
    pageCount: pageCount(count ?? 0),
  };
}

export async function getTicketDetail(id: string) {
  const supabase = await db();
  const ticket = ok(await supabase.from("tickets").select("*").eq("id", id).maybeSingle(), null as Ticket | null);
  if (!ticket) return null;
  const [messages, services, orders, staff, canned] = await Promise.all([
    supabase.from("ticket_messages").select("*").eq("ticket_id", id).order("created_at", { ascending: true }),
    supabase.from("services").select("*").eq("user_id", ticket.user_id).neq("status", "terminated").order("expires_at", { ascending: true }).limit(10),
    supabase.from("orders").select("*").eq("user_id", ticket.user_id).order("created_at", { ascending: false }).limit(5),
    supabase.from("profiles").select("id, email, full_name, role").in("role", ["support", "admin"]).eq("status", "active"),
    supabase.from("canned_responses").select("*").order("title", { ascending: true }),
  ]);
  const msgs = ok(messages, [] as TicketMessage[]);
  const staffRows = ok(staff, [] as Pick<Profile, "id" | "email" | "full_name" | "role">[]);
  const people = await profilesById([ticket.user_id, ...msgs.map((m) => m.author_id)]);
  // signed links for attachments (the staff read policy lets this client sign them)
  const attachments = new Map<string, { name: string; url: string }[]>();
  for (const m of msgs) {
    const list = Array.isArray(m.attachments) ? (m.attachments as unknown[]) : [];
    const out: { name: string; url: string }[] = [];
    for (const a of list) {
      const path = a && typeof a === "object" ? (a as Record<string, unknown>).path : null;
      const name = a && typeof a === "object" ? (a as Record<string, unknown>).name : null;
      if (typeof path !== "string") continue;
      const signed = await supabase.storage.from("ticket-attachments").createSignedUrl(path, 300);
      if (signed.data?.signedUrl) out.push({ name: typeof name === "string" ? name : "Attachment", url: signed.data.signedUrl });
    }
    if (out.length) attachments.set(m.id, out);
  }
  return {
    ticket,
    customer: people.get(ticket.user_id) ?? null,
    people,
    messages: msgs,
    attachments,
    services: ok(services, [] as Service[]),
    orders: ok(orders, [] as Order[]),
    staff: staffRows,
    canned: ok(canned, [] as Tables<"canned_responses">[]),
  };
}

export type InboxView = "unread" | "handled" | "spam" | "all";

export async function listInbox(opts: { view: InboxView; page: number }) {
  const supabase = await db();
  let q = supabase.from("contact_messages").select("*", { count: "exact" });
  if (opts.view !== "all") q = q.eq("status", opts.view);
  q = q.order("created_at", { ascending: opts.view === "unread" });
  const [from, to] = pageRange(opts.page);
  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error("inbox");
  const rows = data ?? [];
  // does the sender already have an account? (lets staff open the customer instead of just emailing)
  const emails = [...new Set(rows.map((r) => r.email.toLowerCase()))];
  const known = emails.length ? ok(await supabase.from("profiles").select("id, email").in("email", emails), [] as { id: string; email: string }[]) : [];
  return {
    items: rows.map((m) => ({ message: m, accountId: known.find((k) => k.email.toLowerCase() === m.email.toLowerCase())?.id ?? null })),
    total: count ?? 0,
    page: opts.page,
    pageCount: pageCount(count ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------
export async function listInvoices(opts: { status?: "paid" | "void"; q?: string; page: number }) {
  const supabase = await db();
  let q = supabase.from("invoices").select("*", { count: "exact" }).order("issued_at", { ascending: false });
  if (opts.status) q = q.eq("status", opts.status);
  const term = cleanSearch(opts.q);
  if (term) {
    const ids = await idsMatchingCustomer(term);
    const parts = [`invoice_number.ilike.%${term}%`];
    if (ids.length) parts.push(`user_id.in.(${ids.join(",")})`);
    q = q.or(parts.join(","));
  }
  const [from, to] = pageRange(opts.page);
  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error("invoices");
  const rows = data ?? [];
  const people = await profilesById(rows.map((i) => i.user_id));
  const orders = rows.length
    ? ok(await supabase.from("orders").select("id, order_number").in("id", rows.map((i) => i.order_id)), [] as Pick<Order, "id" | "order_number">[])
    : [];
  return {
    items: rows.map((i) => ({ invoice: i, customer: people.get(i.user_id) ?? null, orderNumber: orders.find((o) => o.id === i.order_id)?.order_number ?? "—" })),
    total: count ?? 0,
    page: opts.page,
    pageCount: pageCount(count ?? 0),
  };
}

export type { ProfileLite };
export { ADMIN_PAGE };
