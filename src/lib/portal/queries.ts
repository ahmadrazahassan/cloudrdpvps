import "server-only";
import { cache } from "react";
import { fromDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/types/database";
import { serviceState } from "./derive";

/**
 * Read queries for the customer portal. Every one runs as the signed-in user, so
 * row-level security decides what comes back — these functions never filter by user
 * id for safety, only for clarity. A failed query throws (the nearest error.tsx shows it)
 * instead of rendering an empty page that looks like "you have nothing".
 */
const db = cache(createClient);

function ok<T>(r: { data: T | null; error: { code?: string | null; message?: string | null } | null }, fallback: T): T {
  if (r.error) throw fromDbError(r.error);
  return r.data ?? fallback;
}

export type Order = Tables<"orders">;
export type Payment = Tables<"payments">;
export type Service = Tables<"services">;
export type Invoice = Tables<"invoices">;
export type Ticket = Tables<"tickets">;
export type TicketMessage = Tables<"ticket_messages">;
export type Notification = Tables<"notifications">;
export type PaymentMethodRow = Tables<"payment_methods">;

export const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------
export const getUnreadCount = cache(async (): Promise<number> => {
  const supabase = await db();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) return 0; // a failing badge must never break the whole portal
  return count ?? 0;
});

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
export async function getOverview() {
  const supabase = await db();
  const [services, orders, tickets, notifications] = await Promise.all([
    supabase.from("services").select("*").neq("status", "terminated").order("expires_at", { ascending: true }).limit(60),
    supabase
      .from("orders")
      .select("*")
      .in("status", ["awaiting_payment", "under_review", "approved", "provisioning", "rejected"])
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("tickets")
      .select("*")
      .in("status", ["open", "awaiting_customer"])
      .order("last_message_at", { ascending: false })
      .limit(20),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(8),
  ]);
  return {
    services: ok(services, [] as Service[]),
    orders: ok(orders, [] as Order[]),
    tickets: ok(tickets, [] as Ticket[]),
    notifications: ok(notifications, [] as Notification[]),
  };
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------
export type ServiceFilter = "all" | "active" | "expiring" | "suspended" | "expired";

export async function listServices(opts: { filter?: ServiceFilter; q?: string; page?: number; now?: number } = {}) {
  const now = opts.now ?? Date.now();
  const supabase = await db();
  const all = ok(await supabase.from("services").select("*").order("expires_at", { ascending: true }), [] as Service[]);

  const q = opts.q?.trim().toLowerCase();
  const decorated = all.map((s) => ({ service: s, state: serviceState(s, now) }));
  const matches = decorated.filter(({ service, state }) => {
    if (q && !`${service.label} ${service.ip} ${service.plan_name}`.toLowerCase().includes(q)) return false;
    switch (opts.filter) {
      case "active":
        return state.status === "active";
      case "expiring":
        return state.expiringSoon;
      case "suspended":
        return state.status === "suspended";
      case "expired":
        return state.status === "expired";
      default:
        return true;
    }
  });

  const per = 12;
  const page = Math.max(1, opts.page ?? 1);
  return {
    total: matches.length,
    items: matches.slice((page - 1) * per, page * per),
    counts: {
      all: decorated.length,
      active: decorated.filter((d) => d.state.status === "active").length,
      expiring: decorated.filter((d) => d.state.expiringSoon).length,
      suspended: decorated.filter((d) => d.state.status === "suspended").length,
      expired: decorated.filter((d) => d.state.status === "expired").length,
    },
    pageCount: Math.max(1, Math.ceil(matches.length / per)),
    page,
  };
}

export async function getService(id: string) {
  const supabase = await db();
  const row = ok(await supabase.from("services").select("*").eq("id", id).maybeSingle(), null as Service | null);
  return row;
}

/** Orders and tickets that belong to one service (its renewal history and support threads). */
export async function getServiceHistory(service: Service) {
  const supabase = await db();
  const [orders, tickets] = await Promise.all([
    supabase.from("orders").select("*").or(`id.eq.${service.order_id},service_id.eq.${service.id}`).order("created_at", { ascending: false }),
    supabase.from("tickets").select("*").eq("service_id", service.id).order("last_message_at", { ascending: false }).limit(20),
  ]);
  return { orders: ok(orders, [] as Order[]), tickets: ok(tickets, [] as Ticket[]) };
}

// ---------------------------------------------------------------------------
// Orders & payments
// ---------------------------------------------------------------------------
export type OrderFilter = "all" | Enums<"order_status">;
export const ORDER_FILTERS: { id: OrderFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "awaiting_payment", label: "Awaiting payment" },
  { id: "under_review", label: "Under review" },
  { id: "completed", label: "Completed" },
  { id: "rejected", label: "Rejected" },
  { id: "cancelled", label: "Cancelled" },
];

export async function listOrders(opts: { status?: OrderFilter; page?: number } = {}) {
  const supabase = await db();
  const page = Math.max(1, opts.page ?? 1);
  let q = supabase.from("orders").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);
  const { data, error, count } = await q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw fromDbError(error);
  const total = count ?? 0;
  return { items: data ?? [], total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getOrder(id: string) {
  const supabase = await db();
  const order = ok(await supabase.from("orders").select("*").eq("id", id).maybeSingle(), null as Order | null);
  if (!order) return null;

  const [events, payments, service, invoice] = await Promise.all([
    supabase.from("order_events").select("*").eq("order_id", id).order("id", { ascending: true }),
    supabase.from("payments").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("services").select("*").eq("order_id", id).maybeSingle(),
    supabase.from("invoices").select("*").eq("order_id", id).maybeSingle(),
  ]);
  return {
    order,
    events: ok(events, []),
    payments: ok(payments, [] as Payment[]),
    service: ok(service, null as Service | null),
    invoice: ok(invoice, null as Invoice | null),
  };
}

/** Active payment methods (customers can read every column of those — it's where the account details live). */
export async function listPaymentMethods() {
  const supabase = await db();
  return ok(
    await supabase.from("payment_methods").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
    [] as PaymentMethodRow[],
  );
}

/** Short-lived signed URL for one stored file (proof or QR). Null if it can't be signed. */
export async function signedUrl(bucket: "payment-proofs" | "method-qr" | "ticket-attachments", path: string, seconds = 60) {
  const supabase = await db();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  return error ? null : data.signedUrl;
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------
export async function listInvoices() {
  const supabase = await db();
  return ok(await supabase.from("invoices").select("*").order("issued_at", { ascending: false }), [] as Invoice[]);
}

export async function listPayments() {
  const supabase = await db();
  return ok(await supabase.from("payments").select("*").order("created_at", { ascending: false }), [] as Payment[]);
}

/** order id -> order number, for labelling payments and invoices. */
export async function getOrderNumbers(): Promise<Map<string, string>> {
  const supabase = await db();
  const rows = ok(await supabase.from("orders").select("id,order_number").order("created_at", { ascending: false }).limit(500), [] as { id: string; order_number: string }[]);
  return new Map(rows.map((r) => [r.id, r.order_number]));
}

/** An issued invoice with its order and the payment it was issued for (how and when it was paid). */
export async function getInvoice(id: string) {
  const supabase = await db();
  const invoice = ok(await supabase.from("invoices").select("*").eq("id", id).maybeSingle(), null as Invoice | null);
  if (!invoice) return null;
  const [order, payment] = await Promise.all([
    supabase.from("orders").select("*").eq("id", invoice.order_id).maybeSingle(),
    invoice.payment_id ? supabase.from("payments").select("*").eq("id", invoice.payment_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  return { invoice, order: ok(order, null as Order | null), payment: ok(payment, null as Payment | null) };
}

/** Who an order is billed to — the customer's profile (RLS: you can only read your own, staff can read any). */
export async function getBillTo(userId: string) {
  const supabase = await db();
  const row = ok(
    await supabase.from("profiles").select("full_name, email, company, billing_country").eq("id", userId).maybeSingle(),
    null as Pick<Tables<"profiles">, "full_name" | "email" | "company" | "billing_country"> | null,
  );
  return row ? { name: row.full_name || null, email: row.email || null, company: row.company, country: row.billing_country } : null;
}

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------
export type TicketFilter = "all" | Enums<"ticket_status">;
export const TICKET_FILTERS: { id: TicketFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "awaiting_customer", label: "Awaiting your reply" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
];

export async function listTickets(opts: { status?: TicketFilter; q?: string; page?: number } = {}) {
  const supabase = await db();
  const page = Math.max(1, opts.page ?? 1);
  let q = supabase.from("tickets").select("*", { count: "exact" }).order("last_message_at", { ascending: false });
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);
  const term = opts.q?.trim().replace(/[%,()]/g, " ");
  if (term) q = q.ilike("subject", `%${term}%`);
  const { data, error, count } = await q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw fromDbError(error);
  const total = count ?? 0;
  return { items: data ?? [], total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getTicket(id: string) {
  const supabase = await db();
  const ticket = ok(await supabase.from("tickets").select("*").eq("id", id).maybeSingle(), null as Ticket | null);
  if (!ticket) return null;
  const [messages, service] = await Promise.all([
    supabase.from("ticket_messages").select("*").eq("ticket_id", id).order("created_at", { ascending: true }),
    ticket.service_id ? supabase.from("services").select("id,label").eq("id", ticket.service_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  return {
    ticket,
    messages: ok(messages, [] as TicketMessage[]),
    service: ok(service, null as { id: string; label: string } | null),
  };
}

/** The user's services, for the "related service" picker on the new-ticket form. */
export async function listServiceOptions() {
  const supabase = await db();
  return ok(
    await supabase.from("services").select("id,label,ip").neq("status", "terminated").order("label", { ascending: true }),
    [] as { id: string; label: string; ip: string }[],
  );
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export async function listNotifications(page = 1) {
  const supabase = await db();
  const per = 30;
  const p = Math.max(1, page);
  const { data, error, count } = await supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((p - 1) * per, p * per - 1);
  if (error) throw fromDbError(error);
  const total = count ?? 0;
  return { items: data ?? [], total, page: p, pageCount: Math.max(1, Math.ceil(total / per)) };
}
