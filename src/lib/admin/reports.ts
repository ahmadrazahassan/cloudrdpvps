/**
 * Report maths. Pure functions over rows the console already loaded, so they are easy to test and the
 * money is always integer cents. Revenue means PAID invoices (an invoice is only issued when a payment is approved).
 */

export interface ReportInputs {
  orders: { id: string; order_number: string; product: "rdp" | "vps"; plan_name: string; location_name: string; type: "new" | "renewal"; status: string; total_cents: number; discount_cents: number; created_at: string; completed_at: string | null }[];
  invoices: { id: string; order_id: string; total_cents: number; discount_cents: number; status: string; issued_at: string }[];
  payments: { order_id: string; method_name: string; status: string; amount_usd_cents: number }[];
  refunds: { order_id: string; data: unknown }[];
  newCustomers: number;
  tickets: { id: string; created_at: string; last_staff_message_at: string | null }[];
}

export interface Row {
  label: string;
  count: number;
  cents: number;
}

export interface Report {
  grossCents: number;
  discountCents: number;
  refundCents: number;
  netCents: number;
  paidInvoices: number;
  byProduct: Row[];
  byPlan: Row[];
  byLocation: Row[];
  byMethod: Row[];
  newVsRenewal: Row[];
  funnel: { label: string; count: number }[];
  newCustomers: number;
  tickets: { opened: number; answered: number };
}

const rank = (m: Map<string, Row>) => [...m.values()].sort((a, b) => b.cents - a.cents || b.count - a.count);
function add(m: Map<string, Row>, label: string, cents: number) {
  const r = m.get(label) ?? { label, count: 0, cents: 0 };
  r.count += 1;
  r.cents += cents;
  m.set(label, r);
}

export function buildReport(i: ReportInputs): Report {
  const orderById = new Map(i.orders.map((o) => [o.id, o]));
  const paid = i.invoices.filter((inv) => inv.status === "paid");

  const total = paid.reduce((s, inv) => s + inv.total_cents, 0);
  const discounts = paid.reduce((s, inv) => s + inv.discount_cents, 0);
  const refunds = i.refunds.reduce((s, r) => {
    const a = r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>).amount_cents : null;
    return s + (typeof a === "number" ? a : 0);
  }, 0);

  const product = new Map<string, Row>();
  const plan = new Map<string, Row>();
  const location = new Map<string, Row>();
  const kind = new Map<string, Row>();
  for (const inv of paid) {
    const o = orderById.get(inv.order_id);
    if (!o) continue; // an invoice for an order placed before this range: still counted in the totals above
    add(product, o.product.toUpperCase(), inv.total_cents);
    add(plan, `${o.product.toUpperCase()} ${o.plan_name}`, inv.total_cents);
    add(location, o.location_name, inv.total_cents);
    add(kind, o.type === "renewal" ? "Renewals" : "New servers", inv.total_cents);
  }

  const method = new Map<string, Row>();
  for (const p of i.payments) if (p.status === "verified") add(method, p.method_name, p.amount_usd_cents);

  const withProof = new Set(i.payments.map((p) => p.order_id));
  const withVerified = new Set(i.payments.filter((p) => p.status === "verified").map((p) => p.order_id));
  const delivered = i.orders.filter((o) => o.type === "new" && o.status === "completed").length;

  return {
    grossCents: total + discounts,
    discountCents: discounts,
    refundCents: refunds,
    netCents: total - refunds,
    paidInvoices: paid.length,
    byProduct: rank(product),
    byPlan: rank(plan),
    byLocation: rank(location),
    byMethod: rank(method),
    newVsRenewal: rank(kind),
    funnel: [
      { label: "Orders placed", count: i.orders.length },
      { label: "Proof submitted", count: i.orders.filter((o) => withProof.has(o.id)).length },
      { label: "Payment approved", count: i.orders.filter((o) => withVerified.has(o.id)).length },
      { label: "Server delivered (new orders)", count: delivered },
    ],
    newCustomers: i.newCustomers,
    tickets: { opened: i.tickets.length, answered: i.tickets.filter((t) => t.last_staff_message_at).length },
  };
}
