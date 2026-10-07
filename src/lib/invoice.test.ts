import { describe, expect, it } from "vitest";
import * as F from "../test/portal-fixtures";
import { buildInvoiceView } from "./invoice";

const order = (status: string) => {
  const o = F.orders.find((x) => x.status === status);
  if (!o) throw new Error(`no ${status} order in the fixtures`);
  return o;
};
const billTo = { name: "Aisha Khan", email: "aisha.khan@example.com", company: null, country: "PK" };

describe("buildInvoiceView — an issued invoice", () => {
  const invoice = F.invoices[1]!; // $40 less a $4 WELCOME10 coupon
  const orderRow = F.orders.find((o) => o.id === invoice.order_id)!;
  const payment = { ...F.payments[0]!, method_name: "JazzCash", reference: "TX-889123", quoted_currency: "PKR", quoted_amount: 10080, quoted_rate: 280, reviewed_at: "2026-09-26T09:30:00Z" };

  const view = buildInvoiceView({ order: orderRow, invoice, payment, billTo: null })!;

  it("is a paid invoice with its own number, never a proforma", () => {
    expect(view).toMatchObject({ kind: "invoice", title: "Invoice", number: "INV-001002", status: "paid", statusLabel: "Paid", dueAt: null });
    expect(view.orderNumber).toBe("CRV-001006");
  });

  it("reads the customer from the snapshot taken when the invoice was issued", () => {
    expect(view.billTo).toEqual({ name: "Aisha Khan", email: "aisha.khan@example.com", company: null, country: "PK" });
  });

  it("adds up: subtotal − discount = total = paid, nothing left to pay", () => {
    expect(view).toMatchObject({ subtotalCents: 4000, discountCents: 400, discountCode: "WELCOME10", totalCents: 3600, paidCents: 3600, balanceCents: 0 });
    expect(view.subtotalCents - view.discountCents).toBe(view.totalCents);
  });

  it("describes what was bought: product and plan, location, specs and the service period", () => {
    const [line] = view.lines;
    expect(line!.description).toContain(orderRow.plan_name);
    expect(line!.details.join(" | ")).toContain(`Location: ${orderRow.location_name}`);
    expect(line!.details.join(" | ")).toContain("vCPU");
    expect(orderRow.type).toBe("renewal"); // this fixture is a renewal, so the period reads as an extension
    expect(line!.description).toContain("(renewal)");
    expect(line!.details.join(" | ")).toContain("Renewal: 30 days added to your current expiry");
    expect(line!.amountCents).toBe(4000);
  });

  it("shows how it was paid, including what was actually sent in the local currency", () => {
    expect(view.paidAt).toBe("2026-09-26T09:30:00Z");
    expect(view.payment).toEqual({ method: "JazzCash", reference: "TX-889123", localAmount: "PKR 10,080.00 at 1 USD = 280 PKR" });
  });

  it("marks a voided invoice, with nothing paid, and says why", () => {
    const voided = buildInvoiceView({ order: orderRow, invoice: { ...invoice, status: "void", void_reason: "Duplicate" }, payment: null, billTo: null })!;
    expect(voided).toMatchObject({ status: "void", statusLabel: "Void", paidCents: 0, paidAt: null });
    expect(voided.notes.join(" ")).toContain("voided: Duplicate");
  });

  it("marks a refunded order", () => {
    const refunded = buildInvoiceView({ order: { ...orderRow, status: "refunded" }, invoice, payment: null, billTo: null })!;
    expect(refunded.status).toBe("refunded");
  });

  it("still renders if the order itself is gone, from the invoice snapshot alone", () => {
    const lone = buildInvoiceView({ order: null, invoice, payment: null, billTo: null })!;
    expect(lone.lines[0]).toMatchObject({ description: "VPS L — USA (30 days)", amountCents: 4000 });
    expect(lone.orderNumber).toBe("CRV-001006");
  });
});

describe("buildInvoiceView — an order with no invoice yet (proforma)", () => {
  it("an unpaid order is a proforma numbered by the order, due when it expires, with the full amount owing", () => {
    const o = order("awaiting_payment");
    const v = buildInvoiceView({ order: o, invoice: null, payment: null, billTo })!;
    expect(v).toMatchObject({
      kind: "proforma",
      title: "Proforma invoice",
      number: o.order_number,
      status: "unpaid",
      statusLabel: "Awaiting payment",
      dueAt: o.expires_at,
      paidCents: 0,
      balanceCents: o.total_cents,
      totalCents: o.total_cents,
    });
    expect(v.billTo.name).toBe("Aisha Khan");
    expect(v.notes.join(" ")).toContain("cancelled automatically");
    expect(v.lines[0]!.details.join(" | ")).toContain("Service period: 30 days from delivery");
  });

  it("a rejected payment is still payable", () => {
    const v = buildInvoiceView({ order: order("rejected"), invoice: null, payment: null, billTo })!;
    expect(v.status).toBe("unpaid");
    expect(v.dueAt).not.toBeNull();
  });

  it("an order under review says so, and nothing is due by a date", () => {
    const v = buildInvoiceView({ order: order("under_review"), invoice: null, payment: F.payments[0]!, billTo })!;
    expect(v).toMatchObject({ status: "review", statusLabel: "Payment under review", dueAt: null });
    expect(v.payment?.method).toBe(F.payments[0]!.method_name);
  });

  it("a cancelled order owes nothing", () => {
    const v = buildInvoiceView({ order: order("cancelled"), invoice: null, payment: null, billTo })!;
    expect(v).toMatchObject({ status: "cancelled", balanceCents: 0, dueAt: null });
  });

  it("keeps the coupon discount and the maths intact", () => {
    const discounted = F.orders.find((o) => o.discount_cents > 0 && o.status !== "completed") ?? { ...order("awaiting_payment"), list_price_cents: 2500, discount_cents: 500, total_cents: 2000, coupon_code: "SAVE5" };
    const v = buildInvoiceView({ order: discounted, invoice: null, payment: null, billTo })!;
    expect(v.subtotalCents - v.discountCents).toBe(v.totalCents);
    expect(v.discountCode).toBe(discounted.coupon_code);
  });

  it("describes a renewal as extending the current term", () => {
    const v = buildInvoiceView({ order: { ...order("awaiting_payment"), type: "renewal" }, invoice: null, payment: null, billTo })!;
    expect(v.lines[0]!.description).toContain("(renewal)");
    expect(v.lines[0]!.details.join(" ")).toContain("added to your current expiry");
  });

  it("copes with a missing customer record", () => {
    const v = buildInvoiceView({ order: order("awaiting_payment"), invoice: null, payment: null, billTo: null })!;
    expect(v.billTo).toEqual({ name: null, email: null, company: null, country: null });
  });

  it("returns nothing when there is neither an order nor an invoice", () => {
    expect(buildInvoiceView({ order: null, invoice: null, payment: null, billTo: null })).toBeNull();
  });
});
