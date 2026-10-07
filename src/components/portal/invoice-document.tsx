import { Logo } from "@/components/brand/logo";
import { PaymentLogo } from "@/components/shared/payment-logo";
import { countryName, formatDate } from "@/lib/format";
import type { InvoiceStatus, InvoiceView } from "@/lib/invoice";
import { cn, formatUsd } from "@/lib/utils";

export interface InvoiceSeller {
  name: string;
  /** Company name, address, tax number… one per line, as the owner wrote them in Admin → Settings. */
  lines: string[];
  email: string | null;
  /** The site's address, e.g. "cloudrdpvps.com". */
  host: string;
}

/** A flat, bordered tag — no fill, no gradient. */
const TONE: Record<InvoiceStatus, string> = {
  paid: "border-ok text-ok",
  unpaid: "border-warn text-warn",
  review: "border-lav-600 text-lav-700",
  void: "border-bad text-bad",
  cancelled: "border-line-2 text-ink-2",
  refunded: "border-line-2 text-ink-2",
};

const money = (cents: number) => formatUsd(cents, { cents: true });

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className="mt-1.5 text-[15px] font-medium text-ink">{children}</dd>
    </div>
  );
}

/**
 * The invoice, laid out like a company's: brand and number on top, the key dates, who it is from and to,
 * what was bought, the totals, how it was paid (or how to pay) and the terms. One component for the issued
 * invoice and the proforma, so they always look the same. Dates are UTC and fixed (a legal document must
 * read the same wherever it is opened). Prints to a clean A4 page — see the print rules in globals.css.
 */
export function InvoiceDocument({
  view,
  seller,
  methods = [],
}: {
  view: InvoiceView;
  seller: InvoiceSeller;
  /** Methods an unpaid invoice can be paid with, shown as logos. */
  methods?: { id: string; name: string; type: string }[];
}) {
  const settled = view.status === "paid" || view.status === "refunded";
  const country = countryName(view.billTo.country);
  const owing = view.status === "unpaid";

  return (
    <article className="invoice mx-auto w-full max-w-[820px] text-ink" aria-label={`${view.title} ${view.number}`}>
      {/* Brand, document type, number, status */}
      <header className="flex flex-wrap items-start justify-between gap-x-10 gap-y-8">
        <Logo href={null} />
        <div className="sm:text-right">
          <p className="label-caps">{view.title}</p>
          <p className="data-id mt-1.5 font-display text-[32px] font-medium leading-none tracking-[-0.03em] text-ink">{view.number}</p>
          <p className={cn("mt-4 inline-block border px-3 py-1 text-[12px] font-medium uppercase tracking-[0.1em]", TONE[view.status])}>
            {view.statusLabel}
          </p>
        </div>
      </header>

      {/* Key facts */}
      <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-line-2 py-6 sm:grid-cols-4">
        <Meta label="Issued">{formatDate(view.issuedAt)}</Meta>
        {settled && view.paidAt ? (
          <Meta label="Paid on">{formatDate(view.paidAt)}</Meta>
        ) : view.dueAt ? (
          <Meta label="Payment due">{formatDate(view.dueAt)}</Meta>
        ) : (
          <Meta label="Payment due">{view.status === "cancelled" ? "Not payable" : "—"}</Meta>
        )}
        <Meta label="Order">
          <span className="data-id">{view.orderNumber}</span>
        </Meta>
        <Meta label="Currency">US dollars (USD)</Meta>
      </dl>

      {/* From / Bill to */}
      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <section aria-label="From">
          <p className="label-caps">From</p>
          <p className="mt-2 text-[15px] font-semibold text-ink">{seller.name}</p>
          <div className="mt-1 space-y-0.5 text-[14px] leading-relaxed text-ink-2">
            {seller.lines.map((l) => (
              <p key={l}>{l}</p>
            ))}
            {seller.email && <p>{seller.email}</p>}
            <p>{seller.host}</p>
          </div>
        </section>
        <section aria-label="Bill to">
          <p className="label-caps">Bill to</p>
          <p className="mt-2 text-[15px] font-semibold text-ink">{view.billTo.name ?? view.billTo.email ?? "Customer"}</p>
          <div className="mt-1 space-y-0.5 text-[14px] leading-relaxed text-ink-2">
            {view.billTo.company && <p>{view.billTo.company}</p>}
            {view.billTo.name && view.billTo.email && <p>{view.billTo.email}</p>}
            {country && <p>{country}</p>}
          </div>
        </section>
      </div>

      {/* What was bought */}
      <table className="mt-10 w-full text-left">
        <thead>
          <tr className="label-caps border-b border-line-2">
            <th scope="col" className="py-3 font-normal">
              Description
            </th>
            <th scope="col" className="hidden w-14 py-3 text-right font-normal sm:table-cell">
              Qty
            </th>
            <th scope="col" className="hidden w-28 py-3 text-right font-normal sm:table-cell">
              Unit price
            </th>
            <th scope="col" className="w-28 py-3 text-right font-normal">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {view.lines.map((line, i) => (
            <tr key={i} className="border-b border-line align-top">
              <td className="py-5 pr-4">
                <p className="text-[15px] font-semibold leading-snug text-ink">{line.description}</p>
                {line.details.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-[13px] leading-relaxed text-muted">
                    {line.details.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="num-tabular hidden py-5 text-right text-[15px] text-ink sm:table-cell">{line.quantity}</td>
              <td className="num-tabular hidden py-5 text-right text-[15px] text-ink sm:table-cell">{money(line.unitCents)}</td>
              <td className="num-tabular py-5 text-right text-[15px] font-medium text-ink">{money(line.amountCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <dl className="num-tabular ml-auto mt-6 w-full max-w-[340px] text-[15px]">
        <div className="flex justify-between gap-6 py-1.5">
          <dt className="text-ink-2">Subtotal</dt>
          <dd className="text-ink">{money(view.subtotalCents)}</dd>
        </div>
        {view.discountCents > 0 && (
          <div className="flex justify-between gap-6 py-1.5">
            <dt className="text-ink-2">Discount{view.discountCode ? ` (${view.discountCode})` : ""}</dt>
            <dd className="text-ink">−{money(view.discountCents)}</dd>
          </div>
        )}
        <div className="mt-1.5 flex justify-between gap-6 border-t border-line-2 pt-3 text-[16px] font-semibold">
          <dt className="text-ink">Total</dt>
          <dd className="text-ink">{money(view.totalCents)}</dd>
        </div>
        {view.paidCents > 0 && (
          <div className="flex justify-between gap-6 pb-1.5 pt-3">
            <dt className="text-ink-2">Paid</dt>
            <dd className="text-ok">−{money(view.paidCents)}</dd>
          </div>
        )}
        <div className="mt-3 flex items-baseline justify-between gap-6 border-t-2 border-ink pt-4">
          <dt className="text-[15px] font-semibold text-ink">{owing ? "Amount due" : "Balance due"}</dt>
          <dd className="font-display text-[26px] font-medium leading-none tracking-[-0.025em] text-ink">{money(view.balanceCents)}</dd>
        </div>
      </dl>

      {/* Payment + terms */}
      <div className="mt-12 grid gap-10 border-t border-line-2 pt-8 sm:grid-cols-2">
        <section aria-label="Payment">
          <p className="label-caps">Payment</p>
          {view.payment ? (
            <dl className="mt-3 space-y-3 text-[14px]">
              <div>
                <dt className="text-muted">{settled ? "Paid with" : "Submitted with"}</dt>
                <dd className="mt-1 flex items-center gap-2.5 text-[15px] font-medium text-ink">
                  <span className="flex h-6 w-8 shrink-0 items-center justify-center">
                    <PaymentLogo name={view.payment.method} className="max-h-6 max-w-full object-contain" />
                  </span>
                  {view.payment.method}
                </dd>
              </div>
              {view.payment.reference && (
                <div>
                  <dt className="text-muted">Reference</dt>
                  <dd className="data-id mt-1 break-all text-[15px] font-medium text-ink">{view.payment.reference}</dd>
                </div>
              )}
              {view.payment.localAmount && (
                <div>
                  <dt className="text-muted">Amount sent</dt>
                  <dd className="num-tabular mt-1 text-[15px] font-medium text-ink">{view.payment.localAmount}</dd>
                </div>
              )}
            </dl>
          ) : owing ? (
            <div className="mt-3">
              <p className="text-[14px] leading-relaxed text-ink-2">
                Pay in your dashboard{view.dueAt ? ` by ${formatDate(view.dueAt)}` : ""}, then upload your proof. You can pay with:
              </p>
              {methods.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
                  {methods.map((m) => (
                    <li key={m.id} className="flex items-center gap-2.5 text-[14px] font-medium text-ink">
                      <span className="flex h-6 w-8 shrink-0 items-center justify-center">
                        <PaymentLogo name={m.name} type={m.type} className="max-h-6 max-w-full object-contain" />
                      </span>
                      {m.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
              {view.status === "cancelled"
                ? "Nothing is due on this order."
                : view.status === "void"
                  ? "No payment is held against this invoice."
                  : settled
                    ? "Payment received and verified by our team."
                    : "—"}
            </p>
          )}
        </section>

        <section aria-label="Terms">
          <p className="label-caps">Notes</p>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-muted">
            {view.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="mt-14 border-t border-line pt-6 text-center text-[12.5px] leading-relaxed text-muted">
        <p className="font-medium text-ink-2">Thank you for your business.</p>
        <p className="mt-1">
          {seller.name} · {seller.email ? `${seller.email} · ` : ""}
          {seller.host}
        </p>
      </footer>
    </article>
  );
}
