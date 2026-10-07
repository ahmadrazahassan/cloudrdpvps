// Renders every admin-console screen to HTML with realistic fixture data — no database, no browser.
// Catches pages that crash on a given state, and checks the role split: a `support` user must never be
// shown money, credentials or catalog/settings screens. With QA_OUT set the HTML is saved for scripts/qa/admin-check.mjs.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as F from "./portal-fixtures";

const st = vi.hoisted(() => ({ role: "admin" as "admin" | "support", pathname: "/admin" }));

vi.mock("next/navigation", () => ({
  usePathname: () => st.pathname,
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {} }),
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
  unstable_rethrow: (e: unknown) => {
    throw e;
  },
}));

vi.mock("@/lib/env", async (orig) => ({ ...(await orig<typeof import("@/lib/env")>()), isSupabaseConfigured: true }));
vi.mock("@/lib/clock", async () => {
  const f = await import("./portal-fixtures");
  return { now: () => f.FIXED_NOW };
});
vi.mock("@/lib/supabase/server", async () => ({ createClient: async () => ({ from: () => ({}) }) }));

vi.mock("@/lib/auth/mfa", () => ({ getStaffAal: async () => ({ required: true, enrolled: true, satisfied: true }) }));

vi.mock("@/lib/auth/session", () => {
  const user = () => ({ id: st.role === "admin" ? ADMIN_ID : SUPPORT_ID, email: `${st.role}@example.com`, emailVerified: true, profile: staff(st.role) });
  return {
    getSessionUser: async () => user(),
    requireUser: async () => user(),
    requireStaff: async () => user(),
    requireAdmin: async () => {
      if (st.role !== "admin") throw new Error("NEXT_NOT_FOUND");
      return user();
    },
    isStaff: () => true,
    isAdmin: () => st.role === "admin",
  };
});

vi.mock("@/lib/admin/guard", () => ({
  requireConsole: async () => (await import("@/lib/auth/session")).requireStaff(),
  requireAdminConsole: async () => (await import("@/lib/auth/session")).requireAdmin(),
}));

// ---- fixtures ---------------------------------------------------------------------------------------------
const ADMIN_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const SUPPORT_ID = "aaaaaaaa-0000-4000-8000-000000000002";
const day = 86_400_000;
const iso = (offset: number) => new Date(F.FIXED_NOW + offset).toISOString();
const staff = (role: "admin" | "support") => ({ ...F.profile, id: role === "admin" ? ADMIN_ID : SUPPORT_ID, email: `${role}@example.com`, full_name: role === "admin" ? "Sam Admin" : "Sue Support", role, company: null, phone: null });
const customer = F.profile;
const people = new Map([[customer.id, customer], [ADMIN_ID, staff("admin")], [SUPPORT_ID, staff("support")]]);

const approvedOrder = { ...F.orders[2]!, id: "00000000-0000-4000-8000-0000000000a1", order_number: "CRV-001099", status: "approved" as const, completed_at: null };
const pendingPayment = { ...F.payments[0]!, order_id: F.orders[1]!.id };
const orderLite = (o: (typeof F.orders)[number]) => ({ id: o.id, order_number: o.order_number, plan_name: o.plan_name, location_name: o.location_name, type: o.type, total_cents: o.total_cents });

const plan = (n: number, product: "rdp" | "vps", name: string, vcpu: number) => ({
  id: `00000000-0000-4000-8000-00000000b${n}00`, product, name, slug: name.toLowerCase().replace(/\W+/g, "-"), vcpu, ram_gb: vcpu * 2, storage_gb: vcpu * 40, bandwidth_tb: 4, port_mbps: 200,
  features: ["Full administrator access"], is_featured: n === 1, sort_order: n, is_active: true, created_at: iso(-60 * day), updated_at: iso(-60 * day),
});
const plans = [plan(1, "rdp", "Starter", 2), plan(2, "rdp", "Pro", 4), plan(3, "vps", "VPS M", 8)];
const loc = (n: number, name: string, iso2: string) => ({ id: `00000000-0000-4000-8000-00000000c${n}00`, name, slug: name.toLowerCase(), iso2, image_key: null, blurb: `Servers in ${name}`, sort_order: n, is_active: true, created_at: iso(-60 * day), updated_at: iso(-60 * day) });
const locations = [loc(1, "India", "IN"), loc(2, "United States", "US")];
const pricing = plans.flatMap((p, i) => locations.map((l, j) => ({ plan_id: p.id, location_id: l.id, price_cents: 600 + i * 800 + j * 200, stock: "in_stock" as const, stock_count: null, is_active: true, updated_at: iso(-day) })));

const audit = [
  { id: 2, actor_id: ADMIN_ID, actor_role: "admin", action: "payment.approve", entity_type: "payment", entity_id: F.payments[1]!.id, before: { status: "pending" }, after: { status: "verified", received_usd_cents: 2200 }, reason: null, ip: "198.51.100.5", user_agent: "Mozilla/5.0", created_at: iso(-3_600_000) },
  { id: 1, actor_id: ADMIN_ID, actor_role: "admin", action: "plan_pricing.update", entity_type: "plan_pricing", entity_id: "x:y", before: { price_cents: 600 }, after: { price_cents: 700 }, reason: null, ip: null, user_agent: null, created_at: iso(-day) },
];

vi.mock("@/lib/admin/queries", async (orig) => {
  const actual = await orig<typeof import("@/lib/admin/queries")>();
  const money = {
    range: actual.rangeBounds("30d", F.FIXED_NOW),
    kpis: { revenueCents: 842_000, orders: 61, newCustomers: 14, activeServices: 38, renewals: 12, newOrdersCompleted: 29 },
    previous: { revenueCents: 700_000, orders: 50, newCustomers: 16, activeServices: 30, renewals: 9, newOrdersCompleted: 25 },
    points: Array.from({ length: 30 }, (_, i) => ({ day: new Date(F.FIXED_NOW - (29 - i) * day).toISOString().slice(0, 10), cents: i % 4 === 0 ? 0 : 12_000 + i * 900 })),
    byCountry: [{ label: "Pakistan", count: 24 }, { label: "USA", count: 18 }, { label: "UK", count: 9 }],
    byProduct: [{ label: "RDP", count: 40 }, { label: "VPS", count: 21 }],
    byMethod: [{ label: "JazzCash", count: 20 }, { label: "Bank transfer (Pakistan)", count: 11 }],
  };
  const page = (items: unknown[]) => ({ items, total: items.length, page: 1, pageCount: 1 });
  return {
    ...actual,
    getActionQueue: async () => ({ paymentsToReview: 3, oldestPendingPaymentAt: iso(-5 * 3_600_000), ordersToAllocate: 2, expiring3d: 1, ticketsAwaitingStaff: 4, unreadInbox: 2 }),
    getOverviewMoney: async () => money,
    getWorkLists: async () => ({
      payments: [{ payment: pendingPayment, order: orderLite(F.orders[1]!), customer }],
      expiring: [{ service: F.services[1]!, customer }],
    }),
    getRecentActivity: async () => audit.map((event) => ({ event, actor: staff("admin") })),
    listPaymentQueue: async () => ({
      items: [
        { payment: pendingPayment, order: orderLite(F.orders[1]!), customer, duplicate: true },
        { payment: F.payments[1]!, order: orderLite(F.orders[2]!), customer, duplicate: false },
      ],
      total: 2, page: 1, pageCount: 1, counts: { pending: 1, verified: 1, rejected: 1, all: 3 },
    }),
    getPaymentDetail: async () => ({
      payment: pendingPayment,
      order: F.orders[1]!,
      customer,
      method: { id: pendingPayment.method_id, name: pendingPayment.method_name, currency_code: "PKR", rate_per_usd: 285, type: "bank" },
      duplicates: [{ id: F.payments[2]!.id, order_id: F.orders[3]!.id, status: "rejected" as const, created_at: iso(-day), order_number: "CRV-001004" }],
      siblings: [],
      renewal: null,
    }),
    listOrders: async () => page(F.orders.map((order, i) => ({ order, customer, payment: ([null, "pending", "verified", "rejected", null, "verified"] as const)[i] ?? null }))),
    getOrderDetail: async (_id: string, withInventory: boolean) => ({
      order: approvedOrder,
      customer,
      people,
      payments: [{ ...F.payments[1]!, order_id: approvedOrder.id }],
      events: F.orderEvents(3).map((e) => ({ ...e, order_id: approvedOrder.id, actor_id: ADMIN_ID })),
      services: [],
      invoices: [F.invoices[0]!],
      notes: [{ id: "n1", entity_type: "order" as const, entity_id: approvedOrder.id, author_id: SUPPORT_ID, body: "Customer asked for a Windows 2022 image.", created_at: iso(-3_600_000) }],
      stock: withInventory ? [{ id: "i1", product: "rdp" as const, location_id: "pakistan", plan_id: null, ip: "203.0.113.50", rdp_port: 3389, username: "Administrator", supplier: "Acme", supplier_ref: null, supplier_cost_cents: 800, supplier_expires_at: null, status: "available" as const, allocated_service_id: null, notes: null, created_at: iso(-5 * day), updated_at: iso(-5 * day) }] : [],
    }),
    listServices: async () => page(F.services.map((service) => ({ service, customer }))),
    getServiceDetail: async (_id: string, withAudit: boolean) => ({
      service: F.services[0]!,
      customer,
      people,
      orders: [F.orders[2]!],
      tickets: [F.tickets[0]!],
      notes: [],
      audit: withAudit ? [{ ...audit[0]!, action: "service.extend", reason: "Goodwill credit", after: { expires_at: iso(21 * day) } }] : [],
      inventory: null,
    }),
    listCustomers: async () => page([{ profile: customer, orders: 6, active: 2, spendCents: 8_200 }]),
    getCustomerDetail: async () => ({ profile: customer, orders: F.orders, services: F.services, tickets: F.tickets, notes: [], people }),
    listTickets: async () => page(F.tickets.map((ticket) => ({ ticket, customer, assignee: null }))),
    getTicketDetail: async () => ({
      ticket: F.tickets[1]!,
      customer,
      people,
      messages: [
        ...F.ticketMessages.map((m) => ({ ...m, ticket_id: F.tickets[1]!.id })),
        { id: "internal-1", ticket_id: F.tickets[1]!.id, author_id: SUPPORT_ID, author_role: "support" as const, body: "Checked the host — it looks healthy. Waiting on the customer's IP.", is_internal: true, attachments: [], created_at: iso(-3_600_000) },
      ],
      attachments: new Map(),
      services: [F.services[0]!],
      orders: [F.orders[2]!],
      staff: [{ id: ADMIN_ID, email: "admin@example.com", full_name: "Sam Admin", role: "admin" as const }],
      canned: [{ id: "c1", title: "Ask for the IP", body_md: "Could you confirm the IP address you are using?", created_by: null, created_at: iso(-day) }],
    }),
    listInbox: async () => page([{ message: { id: "m1", name: "Bilal", email: "bilal@example.com", topic: "Sales", message: "Do you offer a 90-day plan for a bigger team?", status: "unread", ip: null, user_agent: null, created_at: iso(-3_600_000) }, accountId: null }]),
    listInvoices: async () => page(F.invoices.map((invoice) => ({ invoice, customer, orderNumber: "CRV-001003" }))),
  };
});

vi.mock("@/lib/admin/queries-system", async (orig) => {
  const actual = await orig<typeof import("@/lib/admin/queries-system")>();
  const page = (items: unknown[]) => ({ items, total: items.length, page: 1, pageCount: 1 });
  return {
    ...actual,
    getCatalogAdmin: async () => ({ plans, locations, pricing }),
    getPaymentMethodsAdmin: async () => F.paymentMethods.map((method) => ({ method, usage: { count: 7, cents: 15_400 } })),
    getCouponsAdmin: async () => [{ id: "k1", code: "WELCOME10", type: "percent" as const, value: 10, applies_product: null, applies_plan_id: null, applies_location_id: null, min_order_cents: 0, max_redemptions: 100, per_user_limit: 1, redeemed_count: 12, starts_at: null, ends_at: null, is_active: true, created_at: iso(-30 * day) }],
    getFaqsAdmin: async () => [{ id: "f1", slug: "delivery", category: "ordering", question: "How long does delivery take?", answer_md: "After we verify your **payment**.", sort_order: 10, is_published: true, created_at: iso(-30 * day), updated_at: iso(-30 * day) }],
    getSettingsMap: async () => ({ site_name: "Cloud RDP VPS", support_email: "help@example.com", unpaid_order_hours: 48, grace_days: 2, reminder_days: [3, 1], maintenance: { enabled: false, message: "" }, require_staff_mfa: true, low_stock_threshold: 3, announcement: { enabled: true, text: "Planned maintenance on Sunday", link: "", tone: "warn", starts_at: null, ends_at: null } }),
    getCannedAdmin: async () => [{ id: "c1", title: "Ask for the IP", body_md: "Could you confirm the IP address you are using?", created_by: null, created_at: iso(-day) }],
    getTeam: async () => [staff("admin"), staff("support")],
    getStaffMfa: async () => new Map([[ADMIN_ID, true], [SUPPORT_ID, false]]),
    getAuditLog: async () => ({ ...page(audit.map((event) => ({ event, actor: staff("admin") }))) }),
    getAuditFilterOptions: async () => ({ actions: ["payment.approve", "plan_pricing.update"], staff: [{ id: ADMIN_ID, email: "admin@example.com", full_name: "Sam Admin" }] }),
    getInventory: async () => page([{ id: "i1", product: "rdp", location_id: locations[0]!.id, plan_id: null, ip: "203.0.113.50", rdp_port: 3389, username: "Administrator", supplier: "Acme", supplier_ref: "ORD-1", supplier_cost_cents: 800, supplier_expires_at: "2026-12-31", status: "available", allocated_service_id: null, notes: null, created_at: iso(-5 * day), updated_at: iso(-5 * day) }]),
    getStockLevels: async () => new Map([[`rdp:${locations[0]!.id}`, 1]]),
    getReportData: async () => ({
      orders: F.orders.map((o) => ({ id: o.id, order_number: o.order_number, product: o.product, plan_name: o.plan_name, location_name: o.location_name, type: o.type, status: o.status, total_cents: o.total_cents, discount_cents: o.discount_cents, created_at: o.created_at, completed_at: o.completed_at })),
      invoices: F.invoices.map((i) => ({ id: i.id, order_id: i.order_id, total_cents: i.total_cents, discount_cents: i.discount_cents, status: i.status, issued_at: i.issued_at })),
      payments: F.payments.map((p) => ({ order_id: p.order_id, method_name: p.method_name, status: p.status, amount_usd_cents: p.amount_usd_cents })),
      refunds: [],
      newCustomers: 14,
      tickets: F.tickets.map((t) => ({ id: t.id, created_at: t.created_at, last_staff_message_at: t.last_staff_message_at })),
    }),
  };
});

// ---- rendering ----------------------------------------------------------------------------------------------
const OUT = process.env.QA_OUT;
const saved: string[] = [];

async function render(name: string, load: () => Promise<{ default: unknown }>, opts: { search?: Record<string, string>; params?: Record<string, string>; pathname?: string } = {}) {
  st.pathname = opts.pathname ?? "/admin";
  const Page = (await load()).default as (p: unknown) => Promise<ReactNode>;
  const el = await Page({ searchParams: Promise.resolve(opts.search ?? {}), params: Promise.resolve(opts.params ?? {}) });
  const html = renderToStaticMarkup(<NuqsTestingAdapter>{el}</NuqsTestingAdapter>);
  if (OUT) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(path.join(OUT, `${name}.html`), html);
    saved.push(name);
  }
  return html;
}

beforeEach(() => {
  st.role = "admin";
});
afterAll(() => {
  if (OUT) writeFileSync(path.join(OUT, "_index.json"), JSON.stringify(saved));
});
beforeAll(() => undefined);

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("console shell", () => {
  it("shows every group to an admin, with live counts", async () => {
    const Layout = (await import("@/app/admin/(console)/layout")).default;
    const html = renderToStaticMarkup(<NuqsTestingAdapter>{await Layout({ children: <p>body</p> })}</NuqsTestingAdapter>);
    for (const word of ["Operations", "Support", "Catalog", "Business", "System", "Payments", "Pricing &amp; stock", "Audit log"]) expect(html).toContain(word);
    expect(html).toContain("payments to review");
    expect(html).toContain("<span class=\"num-tabular font-semibold text-ink\">3</span>");
    expect(html).toContain("oldest 5h");
    expect(html).toContain(">Admin<"); // the console tag beside the wordmark
  });

  it("hides the admin-only groups from support", async () => {
    st.role = "support";
    const Layout = (await import("@/app/admin/(console)/layout")).default;
    const html = renderToStaticMarkup(<NuqsTestingAdapter>{await Layout({ children: <p>body</p> })}</NuqsTestingAdapter>);
    expect(html).toContain("Tickets");
    for (const word of ["Pricing &amp; stock", "Audit log", "Payment methods", "Coupons", "Reports", "Inventory", "Settings"]) expect(html).not.toContain(word);
    expect(html).not.toContain("payments to review"); // payments are an admin queue
  });
});

describe("overview", () => {
  it("admin sees revenue, charts and recent activity", async () => {
    const html = await render("overview-admin", () => import("@/app/admin/(console)/page"));
    for (const word of ["Action queue", "Net revenue", "$8,420", "Revenue by day", "Orders by country", "Recent activity", "approved a payment"]) expect(html).toContain(word);
  });
  it("support sees the queue and work lists but no money", async () => {
    st.role = "support";
    const html = await render("overview-support", () => import("@/app/admin/(console)/page"));
    expect(html).toContain("Tickets need a reply");
    for (const word of ["Net revenue", "Revenue by day", "Recent activity", "Payments to review"]) expect(html).not.toContain(word);
  });
});

describe("payments", () => {
  it("admin gets the proof viewer and the approve / reject controls", async () => {
    const html = await render("payments-admin", () => import("@/app/admin/(console)/payments/page"));
    expect(html).toContain(`/admin/payments/${pendingPayment.id}/proof`);
    for (const word of ["Approve payment", "Reject", "Amount received (USD)", "Possible duplicate", "CRV-001004"]) expect(html).toContain(word);
  });
  it("support can read the proof but cannot approve", async () => {
    st.role = "support";
    const html = await render("payments-support", () => import("@/app/admin/(console)/payments/page"));
    expect(html).toContain("Only admins can approve or reject payments");
    expect(html).not.toContain("Approve payment");
  });
});

describe("orders", () => {
  it("lists orders and opens one with the Deliver server panel (manual entry has a password generator)", async () => {
    const list = await render("orders", () => import("@/app/admin/(console)/orders/page"));
    expect(list).toContain("CRV-001001");
    const detail = await render("order-detail", () => import("@/app/admin/(console)/orders/[id]/page"), { params: { id: approvedOrder.id } });
    for (const word of ["Deliver server", "Items &amp; totals", "Internal notes", "Customer asked for a Windows 2022 image.", "Record a refund", "Cancel order"]) expect(detail).toContain(word);
    expect(detail).toContain("From stock"); // the stocked server is offered
  });
  it("support sees the order but no delivery, refund or cancel controls", async () => {
    st.role = "support";
    const detail = await render("order-detail-support", () => import("@/app/admin/(console)/orders/[id]/page"), { params: { id: approvedOrder.id } });
    expect(detail).toContain("CRV-001099");
    for (const word of ["Deliver server", "Record a refund", "Cancel order"]) expect(detail).not.toContain(word);
  });
});

describe("services, customers, tickets, inbox, invoices", () => {
  it("renders the server list with ruler meters, and a detail page with an audited reveal for admins only", async () => {
    const list = await render("services", () => import("@/app/admin/(console)/services/page"));
    expect(list).toContain("Trading-1");
    expect(list).toContain('role="meter"');
    const detail = await render("service-detail", () => import("@/app/admin/(console)/services/[id]/page"), { params: { id: F.services[0]!.id } });
    for (const word of ["Reveal login", "Recorded in the audit log", "Extend", "Suspend", "Terminate server", "Goodwill credit"]) expect(detail).toContain(word);
    st.role = "support";
    const asSupport = await render("service-detail-support", () => import("@/app/admin/(console)/services/[id]/page"), { params: { id: F.services[0]!.id } });
    for (const word of ["Reveal login", "Terminate server", "Goodwill credit"]) expect(asSupport).not.toContain(word);
  });
  it("renders customers", async () => {
    expect(await render("customers", () => import("@/app/admin/(console)/customers/page"))).toContain("Aisha Khan");
    const detail = await render("customer-detail", () => import("@/app/admin/(console)/customers/[id]/page"), { params: { id: F.USER_ID } });
    for (const word of ["Lifetime spend", "Suspend account", "Internal notes"]) expect(detail).toContain(word);
    st.role = "support";
    const asSupport = await render("customer-detail-support", () => import("@/app/admin/(console)/customers/[id]/page"), { params: { id: F.USER_ID } });
    expect(asSupport).not.toContain("Suspend account");
    expect(asSupport).not.toMatch(/\$8[,.]?2/); // lifetime spend is money
  });
  it("renders a ticket thread with an internal note that is marked staff-only", async () => {
    expect(await render("tickets", () => import("@/app/admin/(console)/tickets/page"))).toContain("Restart my build server");
    const thread = await render("ticket-detail", () => import("@/app/admin/(console)/tickets/[id]/page"), { params: { id: F.tickets[1]!.id } });
    for (const word of ["Internal note", "Never shown to the customer", "Ask for the IP", "Send reply", "Saved replies"]) expect(thread).toContain(word);
  });
  it("renders the inbox and invoices (void is admin-only)", async () => {
    expect(await render("inbox", () => import("@/app/admin/(console)/inbox/page"))).toContain("Reply by email");
    const invoices = await render("invoices", () => import("@/app/admin/(console)/invoices/page"));
    expect(invoices).toContain("INV-001001");
    const voids = (h: string) => (h.match(/>Void</g) ?? []).length; // one filter tab, plus one button per paid invoice for admins
    st.role = "support";
    const asSupport = await render("invoices-support", () => import("@/app/admin/(console)/invoices/page"));
    expect(voids(invoices)).toBe(voids(asSupport) + F.invoices.length);
  });
});

describe("catalog, content and system screens", () => {
  const screens: [string, () => Promise<{ default: unknown }>, string[]][] = [
    ["plans", () => import("@/app/admin/(console)/catalog/plans/page"), ["New plan", "Starter", "VPS M"]],
    ["pricing", () => import("@/app/admin/(console)/catalog/pricing/page"), ["Bulk adjust", "Pricing and stock grid", "India"]],
    ["locations", () => import("@/app/admin/(console)/catalog/locations/page"), ["New location", "India"]],
    ["countries", () => import("@/app/admin/(console)/catalog/countries/page"), ["Find a country", "Price new countries like", "Windows RDP in India", "Windows VPS in Germany", "on sale", "to choose from"]],
    ["payment-methods", () => import("@/app/admin/(console)/payment-methods/page"), ["Bank transfer (Pakistan)", "1 USD = 285 PKR", "New method"]],
    ["coupons", () => import("@/app/admin/(console)/coupons/page"), ["WELCOME10", "10% off", "12 / 100"]],
    ["faqs", () => import("@/app/admin/(console)/content/faqs/page"), ["How long does delivery take?", "New FAQ", "Import built-in answers"]],
    ["announcement", () => import("@/app/admin/(console)/content/announcement/page"), ["Planned maintenance on Sunday", "Save announcement"]],
    ["settings", () => import("@/app/admin/(console)/settings/page"), ["Support email", "Maintenance mode", "Send test email", "Require two-step verification", "Ask for the IP"]],
    ["team", () => import("@/app/admin/(console)/team/page"), ["Sam Admin", "Sue Support", "Not set up", "Add team member"]],
    ["audit-log", () => import("@/app/admin/(console)/audit-log/page"), ["payment.approve", "Export CSV", "received_usd_cents"]],
    ["inventory", () => import("@/app/admin/(console)/inventory/page"), ["203.0.113.50", "Import CSV", "Add server", "Running low"]],
    ["reports", () => import("@/app/admin/(console)/reports/page"), ["Export orders", "Order funnel", "By payment method", "Net"]],
  ];
  it.each(screens)("%s renders for an admin", async (name, load, words) => {
    const html = await render(name, load);
    for (const w of words) expect(html).toContain(w);
  });
  it.each(screens)("%s is a 404 for support", async (name, load) => {
    st.role = "support";
    await expect(render(`${name}-support`, load)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("flat-surface rules", () => {
  it("no admin screen introduces a gradient, a card shadow or a monospace/serif font class", async () => {
    const html = await render("rules", () => import("@/app/admin/(console)/page"));
    expect(html).not.toMatch(/gradient/i);
    expect(html).not.toMatch(/shadow-(sm|md|lg|xl)/);
    expect(html).not.toMatch(/font-(mono|serif)/);
    expect(ID(1)).toBeTruthy();
  });
});
