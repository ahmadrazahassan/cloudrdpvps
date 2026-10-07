/**
 * The invoice document, as plain data. One builder serves every order:
 *  - once a payment is verified there is an issued invoice (INV-…) → "Invoice", paid;
 *  - before that — awaiting payment, under review, cancelled — the order itself is shown as a "Proforma invoice"
 *    numbered by the order, so every order has a document a customer can print or send to their accountant.
 * Pure (no React, no database), so the rules are testable and the page is only layout.
 */
import type { Tables } from "@/types/database";
import { specLine } from "./format";

type Order = Tables<"orders">;
type Invoice = Tables<"invoices">;
type Payment = Tables<"payments">;

export type InvoiceStatus = "paid" | "unpaid" | "review" | "void" | "cancelled" | "refunded";

export interface BillTo {
  name: string | null;
  email: string | null;
  company: string | null;
  country: string | null;
}

export interface InvoiceLine {
  description: string;
  /** Smaller lines under the description: location, specs, service period. */
  details: string[];
  quantity: number;
  unitCents: number;
  amountCents: number;
}

export interface InvoiceView {
  kind: "invoice" | "proforma";
  title: "Invoice" | "Proforma invoice";
  number: string;
  status: InvoiceStatus;
  statusLabel: string;
  issuedAt: string;
  /** Proforma only: when an unpaid order is cancelled automatically. */
  dueAt: string | null;
  paidAt: string | null;
  orderNumber: string;
  currency: string;
  billTo: BillTo;
  lines: InvoiceLine[];
  subtotalCents: number;
  discountCents: number;
  discountCode: string | null;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  payment: { method: string; reference: string | null; localAmount: string | null } | null;
  notes: string[];
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const PRODUCT = { rdp: "Windows RDP", vps: "Windows VPS" } as const;

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: "Paid",
  unpaid: "Awaiting payment",
  review: "Payment under review",
  void: "Void",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** "PKR 56,000.00 at 1 USD = 280 PKR" — what the customer actually sent, when they paid in another currency. */
function localAmount(p: Payment | null): string | null {
  if (!p || !p.quoted_currency || p.quoted_amount === null) return null;
  const code = p.quoted_currency.trim();
  const amount = Number(p.quoted_amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rate = p.quoted_rate !== null ? ` at 1 USD = ${Number(p.quoted_rate)} ${code}` : "";
  return `${code} ${amount}${rate}`;
}

function describeOrder(order: Order): { description: string; details: string[] } {
  const product = PRODUCT[order.product] ?? "Windows server";
  const specs = specLine(order.plan_specs);
  const period =
    order.type === "renewal"
      ? `Renewal: ${order.term_days} days added to your current expiry`
      : `Service period: ${order.term_days} days from delivery`;
  return {
    description: `${product} · ${order.plan_name}${order.type === "renewal" ? " (renewal)" : ""}`,
    details: [`Location: ${order.location_name}`, ...(specs ? [specs] : []), "Windows Server included", period],
  };
}

function payment(p: Payment | null): InvoiceView["payment"] {
  return p ? { method: p.method_name, reference: str(p.reference), localAmount: localAmount(p) } : null;
}

/**
 * @param order    the order (always present for a customer's invoice; null only if it has been deleted)
 * @param invoice  the issued invoice, if one exists
 * @param pay      the verified payment for an issued invoice, or the latest payment on an unpaid order
 * @param billTo   the customer, from the profile (used when there is no invoice snapshot to read)
 */
export function buildInvoiceView(input: { order: Order | null; invoice: Invoice | null; payment: Payment | null; billTo: BillTo | null }): InvoiceView | null {
  const { order, invoice } = input;
  if (!order && !invoice) return null;

  // ---- issued invoice ------------------------------------------------------------------------------------------
  if (invoice) {
    const snap = (invoice.billing_snapshot ?? {}) as Record<string, unknown>;
    const status: InvoiceStatus = invoice.status === "void" ? "void" : order?.status === "refunded" ? "refunded" : "paid";
    const items = (Array.isArray(snap.items) ? snap.items : []) as { description?: unknown; amount_cents?: unknown }[];

    const lines: InvoiceLine[] = order
      ? [{ ...describeOrder(order), quantity: 1, unitCents: invoice.subtotal_cents, amountCents: invoice.subtotal_cents }]
      : items.length > 0
        ? items.map((it) => {
            const amount = typeof it.amount_cents === "number" ? it.amount_cents : invoice.subtotal_cents;
            return { description: str(it.description) ?? "Windows server", details: [], quantity: 1, unitCents: amount, amountCents: amount };
          })
        : [{ description: "Windows server", details: [], quantity: 1, unitCents: invoice.subtotal_cents, amountCents: invoice.subtotal_cents }];

    const voided = status === "void";
    return {
      kind: "invoice",
      title: "Invoice",
      number: invoice.invoice_number,
      status,
      statusLabel: STATUS_LABEL[status],
      issuedAt: invoice.issued_at,
      dueAt: null,
      paidAt: voided ? null : (input.payment?.reviewed_at ?? invoice.issued_at),
      orderNumber: str(snap.order_number) ?? order?.order_number ?? "—",
      currency: invoice.currency.trim(),
      billTo: { name: str(snap.name), email: str(snap.email), company: str(snap.company), country: str(snap.country) },
      lines,
      subtotalCents: invoice.subtotal_cents,
      discountCents: invoice.discount_cents,
      discountCode: str(snap.discount_code),
      totalCents: invoice.total_cents,
      paidCents: voided ? 0 : invoice.total_cents,
      balanceCents: 0,
      payment: payment(input.payment),
      notes: [
        "Your server is delivered after the payment is verified.",
        ...(order ? [`Each plan runs for ${order.term_days} days from delivery.`] : []),
        "All amounts are in US dollars.",
        ...(voided ? [`This invoice has been voided${str(invoice.void_reason) ? `: ${str(invoice.void_reason)}` : "."}`] : []),
        ...(status === "refunded" ? ["This order was refunded."] : []),
      ],
    };
  }

  // ---- no invoice yet: the order, as a proforma ----------------------------------------------------------------
  const o = order!;
  const status: InvoiceStatus =
    o.status === "cancelled" ? "cancelled" : o.status === "under_review" ? "review" : o.status === "awaiting_payment" || o.status === "rejected" ? "unpaid" : "paid";
  const payable = status === "unpaid";
  const bill = input.billTo;

  return {
    kind: "proforma",
    title: "Proforma invoice",
    number: o.order_number,
    status,
    statusLabel: STATUS_LABEL[status],
    issuedAt: o.created_at,
    dueAt: payable ? o.expires_at : null,
    paidAt: null,
    orderNumber: o.order_number,
    currency: o.currency.trim(),
    billTo: { name: str(bill?.name), email: str(bill?.email), company: str(bill?.company), country: str(bill?.country) },
    lines: [{ ...describeOrder(o), quantity: 1, unitCents: o.list_price_cents, amountCents: o.list_price_cents }],
    subtotalCents: o.list_price_cents,
    discountCents: o.discount_cents,
    discountCode: str(o.coupon_code),
    totalCents: o.total_cents,
    paidCents: 0,
    balanceCents: status === "cancelled" ? 0 : o.total_cents,
    payment: status === "review" ? payment(input.payment) : null,
    notes: [
      "A proforma invoice is issued before payment. Your final invoice is created automatically once the payment is verified.",
      "Your server is delivered after the payment is verified.",
      `Each plan runs for ${o.term_days} days from delivery.`,
      "All amounts are in US dollars.",
      ...(payable ? ["Unpaid orders are cancelled automatically after the due date."] : []),
      ...(status === "cancelled" ? ["This order was cancelled. Nothing is due."] : []),
    ],
  };
}
