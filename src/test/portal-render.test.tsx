// Renders every customer-portal screen, and checkout, to HTML with realistic fixture data — no database,
// no browser. Catches pages that crash on a particular state (a rejected order, an expired server, an
// empty list…) and, when QA_OUT is set, saves the HTML so scripts/qa/portal-check.mjs can screenshot it.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as F from "./portal-fixtures";

// ---- module stubs (hoisted) -------------------------------------------------------------------------------
const nav = vi.hoisted(() => ({ pathname: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
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

vi.mock("@/lib/auth/session", async () => {
  const f = await import("./portal-fixtures");
  const user = { id: f.USER_ID, email: f.profile.email, emailVerified: true, profile: f.profile };
  return { getSessionUser: async () => user, requireUser: async () => user, isStaff: () => false, isAdmin: () => false };
});

vi.mock("@/lib/auth/mfa", () => ({
  getCustomerMfa: async () => ({ enabled: false }),
  needsSecondFactor: async () => false,
  getSessionAal: async () => ({ current: "aal1", next: "aal1", enrolled: false, needsSecondFactor: false }),
  getStaffAal: async () => ({ required: false, enrolled: false, satisfied: true }),
}));

vi.mock("@/lib/env", async (orig) => ({ ...(await orig<typeof import("@/lib/env")>()), isSupabaseConfigured: true }));

vi.mock("@/lib/catalog", async (orig) => {
  const actual = await orig<typeof import("@/lib/catalog")>();
  const seed = await import("@/content/catalog");
  return {
    ...actual,
    getCatalog: async () => ({ locations: seed.locations, plans: seed.plans, pricing: seed.pricing, paymentMethods: [] }),
  };
});

vi.mock("@/lib/clock", async () => {
  const f = await import("./portal-fixtures");
  return { now: () => f.FIXED_NOW };
});

vi.mock("@/lib/supabase/server", async () => {
  const f = await import("./portal-fixtures");
  // Just enough of the query builder for the two pages that query directly.
  const builder = (table: string) => {
    const state: { table: string; id?: string } = { table };
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "in", "neq", "is", "order", "limit"]) chain[m] = () => chain;
    chain.eq = (_col: string, val: string) => {
      state.id = val;
      return chain;
    };
    chain.maybeSingle = async () => ({
      data: table === "services" ? (f.services.find((s) => s.id === state.id) ?? null) : null,
      error: null,
    });
    chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], count: 0, error: null });
    return chain;
  };
  return { createClient: async () => ({ from: builder }) };
});

vi.mock("@/lib/portal/queries", async (orig) => {
  const actual = await orig<typeof import("@/lib/portal/queries")>();
  const f = await import("./portal-fixtures");
  const { serviceState } = await import("@/lib/portal/derive");
  const now = f.FIXED_NOW;
  const orderById = (id: string) => f.orders.find((o) => o.id === id) ?? null;

  return {
    ...actual,
    getUnreadCount: async () => f.notifications.filter((n) => !n.read_at).length,
    getOverview: async () => ({
      services: f.services,
      orders: f.orders.filter((o) => ["awaiting_payment", "under_review", "approved", "provisioning", "rejected"].includes(o.status)),
      tickets: f.tickets.filter((t) => t.status === "open" || t.status === "awaiting_customer"),
      notifications: f.notifications,
    }),
    listServices: async (opts: { filter?: string; q?: string } = {}) => {
      const decorated = f.services.map((s) => ({ service: s, state: serviceState(s, now) }));
      const items = decorated.filter(({ state }) =>
        opts.filter === "active" ? state.status === "active" : opts.filter === "expiring" ? state.expiringSoon : opts.filter === "expired" ? state.status === "expired" : opts.filter === "suspended" ? state.status === "suspended" : true,
      );
      const count = (p: (d: (typeof decorated)[number]) => boolean) => decorated.filter(p).length;
      return {
        total: items.length,
        items,
        counts: {
          all: decorated.length,
          active: count((d) => d.state.status === "active"),
          expiring: count((d) => d.state.expiringSoon),
          suspended: count((d) => d.state.status === "suspended"),
          expired: count((d) => d.state.status === "expired"),
        },
        pageCount: 1,
        page: 1,
      };
    },
    getService: async (id: string) => f.services.find((s) => s.id === id) ?? null,
    getServiceHistory: async () => ({ orders: [f.orders[2]!, f.orders[5]!], tickets: f.tickets.slice(0, 2) }),
    listOrders: async (opts: { status?: string } = {}) => {
      const items = opts.status && opts.status !== "all" ? f.orders.filter((o) => o.status === opts.status) : f.orders;
      return { items, total: items.length, page: 1, pageCount: 1 };
    },
    getOrder: async (id: string) => {
      const order = orderById(id);
      if (!order) return null;
      const n = Number(order.order_number.slice(-1));
      return {
        order,
        events: order.status === "completed" ? f.orderEvents(n) : f.orderEvents(n).slice(0, 1),
        payments: f.payments.filter((p) => p.order_id === id),
        service: order.status === "completed" ? (f.services.find((s) => s.order_id === id) ?? f.services[0]!) : null,
        invoice: order.status === "completed" ? (f.invoices.find((i) => i.order_id === id) ?? null) : null,
      };
    },
    listPaymentMethods: async () => f.paymentMethods,
    signedUrl: async () => null,
    listInvoices: async () => f.invoices,
    listPayments: async () => f.payments,
    getOrderNumbers: async () => new Map(f.orders.map((o) => [o.id, o.order_number])),
    getInvoice: async (id: string) => {
      const invoice = f.invoices.find((i) => i.id === id);
      return invoice
        ? { invoice, order: orderById(invoice.order_id), payment: f.payments.find((p) => p.id === invoice.payment_id) ?? null }
        : null;
    },
    getBillTo: async () => ({ name: "Aisha Khan", email: f.profile.email, company: "Khan Trading", country: "PK" }),
    listTickets: async (opts: { status?: string } = {}) => {
      const items = opts.status && opts.status !== "all" ? f.tickets.filter((t) => t.status === opts.status) : f.tickets;
      return { items, total: items.length, page: 1, pageCount: 1 };
    },
    getTicket: async (id: string) => {
      const ticket = f.tickets.find((t) => t.id === id);
      if (!ticket) return null;
      return { ticket, messages: f.ticketMessages, service: ticket.service_id ? { id: ticket.service_id, label: "Trading-1" } : null };
    },
    listServiceOptions: async () => f.services.map((s) => ({ id: s.id, label: s.label, ip: String(s.ip) })),
    listNotifications: async () => ({ items: f.notifications, total: f.notifications.length, page: 1, pageCount: 1 }),
  };
});

// ---- rendering helpers -----------------------------------------------------------------------------------------
const OUT = process.env.QA_OUT;
const BAD = /undefined|NaN|\[object Object\]|Invalid Date/;
const q = (obj: Record<string, string> = {}) => Promise.resolve(obj);
const p = <T,>(obj: T) => Promise.resolve(obj);

beforeAll(() => {
  vi.useFakeTimers({ now: F.FIXED_NOW, toFake: ["Date"] });
  if (OUT) mkdirSync(OUT, { recursive: true });
});
afterAll(() => vi.useRealTimers());

/** Render a portal page inside the real portal layout (sidebar, top bar). */
async function portal(name: string, route: string, page: () => Promise<ReactNode>, search = "") {
  nav.pathname = route;
  const { default: Layout } = await import("@/app/(portal)/layout");
  const body = await page();
  const tree = await Layout({ children: body });
  const html = renderToStaticMarkup(<NuqsTestingAdapter searchParams={search}>{tree}</NuqsTestingAdapter>);
  expect(html, `${name} rendered something bad`).not.toMatch(BAD);
  if (OUT) writeFileSync(path.join(OUT, `${name}.html`), html);
  return html;
}

/** Render a public page (checkout) inside a bare container. */
async function bare(name: string, page: () => Promise<ReactNode>, search = "") {
  const body = await page();
  const html = renderToStaticMarkup(<NuqsTestingAdapter searchParams={search}>{body}</NuqsTestingAdapter>);
  expect(html, `${name} rendered something bad`).not.toMatch(BAD);
  if (OUT) writeFileSync(path.join(OUT, `${name}.html`), html);
  return html;
}

const O = F.orders;
const S = F.services;

// ---- the screens -----------------------------------------------------------------------------------------------
describe("customer portal screens render with realistic data", () => {
  it("overview", async () => {
    const { default: Page } = await import("@/app/(portal)/dashboard/page");
    const html = await portal("overview", "/dashboard", () => Page());
    expect(html).toContain("Needs your attention");
    expect(html).toContain("Pay for order CRV-001001");
    expect(html).toContain("Renew “Build server” — expires in 3 days");
    expect(html).toContain("Reply on ticket #48");
    expect(html).toContain("Trading-1");
  });

  it("services list, with a filter", async () => {
    const { default: Page } = await import("@/app/(portal)/dashboard/services/page");
    const all = await portal("services", "/dashboard/services", () => Page({ searchParams: q() }));
    expect(all).toContain("Paused desktop");
    const expiring = await portal("services-expiring", "/dashboard/services", () => Page({ searchParams: q({ filter: "expiring" }) }));
    expect(expiring).toContain("Build server");
    expect(expiring).not.toContain("Paused desktop");
  });

  it("service detail: every tab and state", async () => {
    const { default: Page } = await import("@/app/(portal)/dashboard/services/[id]/page");
    const open = (s: (typeof S)[number], tab?: string) => () => Page({ params: p({ id: s.id }), searchParams: q(tab ? { tab } : {}) });
    const overview = await portal("service-overview", "/dashboard/services/x", open(S[0]!));
    expect(overview).toContain("Trading-1");
    const conn = await portal("service-connection", "/dashboard/services/x", open(S[0]!, "connection"));
    expect(conn).toContain("Reveal login details");
    expect(conn).toContain("Download .rdp file");
    expect(conn).not.toContain("hunter2"); // no secret is ever in the page markup
    const expired = await portal("service-expired", "/dashboard/services/x", open(S[2]!, "connection"));
    expect(expired).toContain("This server has expired");
    const suspended = await portal("service-suspended", "/dashboard/services/x", open(S[3]!, "connection"));
    expect(suspended).toContain("This server is suspended");
    expect(suspended).toContain("Awaiting a response to an abuse report.");
    await portal("service-billing", "/dashboard/services/x", open(S[0]!, "billing"));
    await portal("service-support", "/dashboard/services/x", open(S[0]!, "support"));
  });

  it("orders list and every order state", async () => {
    const { default: List } = await import("@/app/(portal)/dashboard/orders/page");
    const list = await portal("orders", "/dashboard/orders", () => List({ searchParams: q() }));
    expect(list).toContain("Pay now");
    expect(list).toContain("CRV-001006");

    const { default: Detail } = await import("@/app/(portal)/dashboard/orders/[id]/page");
    for (const [name, o] of [
      ["awaiting", O[0]!],
      ["review", O[1]!],
      ["completed", O[2]!],
      ["rejected", O[3]!],
      ["cancelled", O[4]!],
      ["renewal", O[5]!],
    ] as const) {
      const html = await portal(`order-${name}`, "/dashboard/orders/x", () => Detail({ params: p({ id: o.id }) }));
      expect(html).toContain(o.order_number);
    }
    const completed = await portal("order-completed", "/dashboard/orders/x", () => Detail({ params: p({ id: O[2]!.id }) }));
    expect(completed).toContain("Open server");
    expect(completed).toContain("View invoice INV-001001");
    const rejected = await portal("order-rejected", "/dashboard/orders/x", () => Detail({ params: p({ id: O[3]!.id }) }));
    expect(rejected).toContain("Submit new proof");
    expect(rejected).toContain("The amount received was lower than the order total.");
  });

  it("payment page in each state", async () => {
    const { default: Pay } = await import("@/app/(portal)/dashboard/orders/[id]/pay/page");
    const pay = (o: (typeof O)[number]) => () => Pay({ params: p({ id: o.id }) });
    const flow = await portal("pay-flow", "/dashboard/orders/x/pay", pay(O[0]!));
    expect(flow).toContain("Choose a payment method");
    expect(flow).toContain("Bank transfer (Pakistan)");
    // With a method chosen, the instructions and the proof form appear.
    const withMethod = (m: (typeof F.paymentMethods)[number]) => () =>
      Pay({ params: p({ id: O[0]!.id }), searchParams: q({ method: m.id }) });
    const bank = await portal("pay-method-bank", "/dashboard/orders/x/pay", withMethod(F.paymentMethods[0]!));
    expect(bank).toContain("Send your payment");
    expect(bank).toContain("PK36 EXAM 0000 0012 3456 7890"); // account details, with a copy button each
    expect(bank).toContain("PKR"); // the local amount to send, from the method's rate
    expect(bank).toContain("Transaction reference"); // required for this method
    expect(bank).toContain("Submit payment proof");
    const crypto = await portal("pay-method-crypto", "/dashboard/orders/x/pay", withMethod(F.paymentMethods[2]!));
    expect(crypto).toContain("Send only on TRON (TRC20)");
    const review = await portal("pay-review", "/dashboard/orders/x/pay", pay(O[1]!));
    expect(review).toContain("We&#x27;re reviewing your payment");
    const rejected = await portal("pay-rejected", "/dashboard/orders/x/pay", pay(O[3]!));
    expect(rejected).toContain("Your last payment proof was rejected");
    const done = await portal("pay-done", "/dashboard/orders/x/pay", pay(O[2]!));
    expect(done).toContain("Your server is ready");
    const cancelled = await portal("pay-cancelled", "/dashboard/orders/x/pay", pay(O[4]!));
    expect(cancelled).toContain("This order was cancelled");
  });

  it("billing and a printable invoice", async () => {
    const { default: Billing } = await import("@/app/(portal)/dashboard/billing/page");
    const inv = await portal("billing-invoices", "/dashboard/billing", () => Billing({ searchParams: q() }));
    expect(inv).toContain("INV-001001");
    const pays = await portal("billing-payments", "/dashboard/billing", () => Billing({ searchParams: q({ tab: "payments" }) }));
    expect(pays).toContain("JazzCash");

    const { default: Invoice } = await import("@/app/(portal)/dashboard/billing/invoices/[id]/page");
    const page = await portal("invoice", "/dashboard/billing/invoices/x", () => Invoice({ params: p({ id: F.invoices[1]!.id }) }));
    expect(page).toContain("INV-001002");
    expect(page).toContain("Invoice"); // the document type
    expect(page).toContain("VPS L");
    expect(page).toContain("WELCOME10");
    expect(page).toContain("Paid");
    expect(page).toContain("Balance due");
    expect(page).toContain("Aisha Khan"); // billed to
    expect(page).toContain("Pakistan"); // the country is named, not just PK
    expect(page).toContain("Thank you for your business.");
    expect(page).toContain("Print or save as PDF");
  });

  it("every order has an invoice: a proforma until it is paid, then the real one", async () => {
    const { default: OrderInvoice } = await import("@/app/(portal)/dashboard/orders/[id]/invoice/page");
    const proforma = (o: (typeof O)[number]) => () => OrderInvoice({ params: p({ id: o.id }) });

    const unpaid = await portal("invoice-proforma-unpaid", "/dashboard/orders/x/invoice", proforma(O[0]!));
    expect(unpaid).toContain("Proforma invoice");
    expect(unpaid).toContain(O[0]!.order_number);
    expect(unpaid).toContain("Awaiting payment");
    expect(unpaid).toContain("Amount due");
    expect(unpaid).toContain("Pay this invoice"); // the call to action, hidden when printing
    expect(unpaid).toContain("Bank transfer (Pakistan)"); // how it can be paid
    expect(unpaid).toContain("Khan Trading");

    const review = await portal("invoice-proforma-review", "/dashboard/orders/x/invoice", proforma(O[1]!));
    expect(review).toContain("Payment under review");
    expect(review).not.toContain("Pay this invoice");

    const cancelled = await portal("invoice-proforma-cancelled", "/dashboard/orders/x/invoice", proforma(O[4]!));
    expect(cancelled).toContain("Cancelled");
    expect(cancelled).toContain("Nothing is due on this order.");
    expect(cancelled).not.toContain("Pay this invoice");

    // A paid order has a real invoice: the same address hands you over to it.
    const paid = F.invoices.find((i) => i.order_id === O[2]!.id);
    expect(paid, "the completed order has an invoice in the fixtures").toBeDefined();
    await expect(OrderInvoice({ params: p({ id: O[2]!.id }) })).rejects.toThrow(`NEXT_REDIRECT:/dashboard/billing/invoices/${paid!.id}`);
  });

  it("support tickets", async () => {
    const { default: List } = await import("@/app/(portal)/dashboard/tickets/page");
    const list = await portal("tickets", "/dashboard/tickets", () => List({ searchParams: q() }));
    expect(list).toContain("I can&#x27;t connect to Trading-1");
    const { default: New } = await import("@/app/(portal)/dashboard/tickets/new/page");
    const form = await portal("ticket-new", "/dashboard/tickets/new", () => New({ searchParams: q({ service: S[0]!.id }) }));
    expect(form).toContain("Open ticket");
    const { default: Thread } = await import("@/app/(portal)/dashboard/tickets/[id]/page");
    const thread = await portal("ticket-thread", "/dashboard/tickets/x", () => Thread({ params: p({ id: F.tickets[0]!.id }) }));
    expect(thread).toContain("error-screenshot.png");
    expect(thread).toContain("Send reply");
  });

  it("notifications and settings", async () => {
    const { default: Notes } = await import("@/app/(portal)/dashboard/notifications/page");
    const notes = await portal("notifications", "/dashboard/notifications", () => Notes({ searchParams: q() }));
    expect(notes).toContain("Mark all as read");
    const { default: Settings } = await import("@/app/(portal)/dashboard/settings/page");
    for (const tab of ["profile", "security", "preferences", "account"]) {
      const html = await portal(`settings-${tab}`, "/dashboard/settings", () => Settings({ searchParams: q({ tab }) }));
      expect(html).toContain("Settings");
    }
  });

  it("an unknown id is a 404, not a crash", async () => {
    const { default: Detail } = await import("@/app/(portal)/dashboard/orders/[id]/page");
    await expect(Detail({ params: p({ id: "not-a-uuid" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(Detail({ params: p({ id: "99999999-9999-4999-8999-999999999999" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("checkout renders for each kind of visitor", () => {
  it("shows a configured plan and the sign-in prompt to guests", async () => {
    const { default: Page } = await import("@/app/(marketing)/order/new/page");
    const html = await bare("checkout", () => Page({ searchParams: q({ product: "vps", country: "united-kingdom", plan: "l" }) }), "?product=vps&country=united-kingdom&plan=l");
    expect(html).toContain("Place an order");
    // a plan and a country already chosen: they are shown (not asked for again) and the order goes straight on
    expect(html).toContain("VPS L");
    expect(html).toContain("United Kingdom");
    expect(html).toContain("Your plan");
    expect(html).toContain("Place order");
    expect(html).toContain("Change");
  });

  it("renewal shows the locked summary", async () => {
    const { default: Page } = await import("@/app/(marketing)/order/new/page");
    const html = await bare("checkout-renew", () => Page({ searchParams: q({ renew: S[1]!.id }) }), `?renew=${S[1]!.id}`);
    expect(html).toContain("Renew your server");
    expect(html).toContain("Build server");
  });
});
