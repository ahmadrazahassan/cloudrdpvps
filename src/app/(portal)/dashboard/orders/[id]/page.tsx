import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WindowsLogo, WindowsOs } from "@/components/brand/windows-logo";
import { CancelOrderButton } from "@/components/portal/cancel-order-button";
import { LocalTime } from "@/components/portal/local-time";
import { OrderTracker } from "@/components/portal/order-tracker";
import { Card, FactGrid, SummaryList } from "@/components/portal/cards";
import { PageHeader, Section } from "@/components/portal/page-header";
import { StatusBadge } from "@/components/portal/status-badge";
import { CountryFlag } from "@/components/shared/primitives";
import { ButtonLink } from "@/components/ui/button";
import { getCatalog } from "@/lib/catalog";
import { now as clock } from "@/lib/clock";
import { specLine } from "@/lib/format";
import { needsPayment, orderTracker } from "@/lib/portal/derive";
import { getOrder, signedUrl } from "@/lib/portal/queries";
import { formatUsd } from "@/lib/utils";

export const metadata: Metadata = { title: "Order" };

type Props = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderPage({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await getOrder(id);
  if (!data) notFound();

  const { order, events, payments, service, invoice } = data;
  const catalog = await getCatalog();
  const location = catalog.locations.find((l) => l.id === order.location_id);
  const latest = payments[0];
  const proofUrl = latest ? await signedUrl("payment-proofs", latest.proof_path, 60) : null;
  const rejectedPayment = payments.find((p) => p.status === "rejected");
  const tracker = orderTracker(order, events);
  const rejectedNote =
    order.status === "rejected"
      ? (rejectedPayment?.reject_message ?? rejectedPayment?.reject_reason ?? "We couldn't verify your payment. You can submit new proof.")
      : null;
  const expired = order.status === "awaiting_payment" && new Date(order.expires_at).getTime() < clock();

  return (
    <>
      <PageHeader
        title={<span className="data-id">{order.order_number}</span>}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusBadge kind="order" status={expired ? "cancelled" : order.status} />
            <span>
              Placed <LocalTime value={order.created_at} />
            </span>
          </span>
        }
        actions={
          <>
            {needsPayment(order.status) && !expired && (
              <ButtonLink href={`/dashboard/orders/${order.id}/pay`}>
                {order.status === "rejected" ? "Submit new proof" : "Pay now"}
              </ButtonLink>
            )}
            {needsPayment(order.status) && !expired && <CancelOrderButton orderId={order.id} orderNumber={order.order_number} />}
            {expired && <ButtonLink href="/order/new">Place a new order</ButtonLink>}
            {service && (
              <ButtonLink href={`/dashboard/services/${service.id}`} variant={needsPayment(order.status) ? "secondary" : "primary"}>
                Open server
              </ButtonLink>
            )}
          </>
        }
      />

      {/* Track your order — centred, full width, above the details */}
      <Card padded aria-label="Order progress" className="mb-5 py-8 sm:py-10">
        <OrderTracker steps={tracker} className="mx-auto max-w-[900px]" />
        {rejectedNote && (
          <p role="status" className="mx-auto mt-8 max-w-[640px] rounded-card bg-bad-bg px-4 py-3 text-[14px] leading-relaxed text-ink">
            {rejectedNote}
          </p>
        )}
        {expired && (
          <p role="status" className="mx-auto mt-8 max-w-[640px] rounded-card bg-bad-bg px-4 py-3 text-[14px] leading-relaxed text-ink">
            This order wasn&apos;t paid in time and was cancelled automatically. Nothing was charged.
          </p>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {latest && (
            <Section title="Payment" description="The most recent payment you submitted for this order.">
              <FactGrid
                items={[
                  { label: "Method", value: latest.method_name },
                  { label: "Amount", value: formatUsd(latest.amount_usd_cents, { cents: true }) + " USD" },
                  ...(latest.quoted_amount && latest.quoted_currency
                    ? [{ label: "Quoted", value: `${latest.quoted_amount} ${latest.quoted_currency}` }]
                    : []),
                  ...(latest.reference ? [{ label: "Reference", value: latest.reference }] : []),
                  { label: "Submitted", value: <LocalTime value={latest.created_at} /> },
                  { label: "Status", value: <StatusBadge kind="payment" status={latest.status} /> },
                ]}
              />

              {latest.status === "rejected" && (latest.reject_message ?? latest.reject_reason) && (
                <p role="status" className="mt-4 rounded-card bg-bad-bg px-4 py-3 text-[14px] leading-relaxed text-ink">
                  {latest.reject_message ?? latest.reject_reason}
                </p>
              )}

              {proofUrl && (
                <div className="mt-6">
                  <p className="text-[13px] font-medium text-muted">Your proof</p>
                  {latest.proof_mime?.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a 60-second signed URL; not optimisable
                    <img src={proofUrl} alt="Payment proof you uploaded" className="mt-3 max-h-[260px] max-w-full rounded-card border border-line object-contain" />
                  ) : (
                    <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="text-link mt-3 inline-block text-[15px]">
                      Open your proof (PDF)
                    </a>
                  )}
                </div>
              )}
            </Section>
          )}

          <Section title="Delivery">
            {service ? (
              <p className="text-[15px] leading-relaxed text-ink-2">
                Your server is ready.{" "}
                <Link href={`/dashboard/services/${service.id}`} className="text-link">
                  Open “{service.label}”
                </Link>{" "}
                to see its connection details.
              </p>
            ) : order.status === "cancelled" || order.status === "refunded" ? (
              <p className="text-[15px] text-muted">This order was not delivered.</p>
            ) : (
              <p className="text-[15px] leading-relaxed text-ink-2">
                We&apos;ll email you and add a notification here as soon as your server is ready.
              </p>
            )}
            <p className="mt-4 text-[15px]">
              {invoice ? (
                <Link href={`/dashboard/billing/invoices/${invoice.id}`} className="text-link">
                  View invoice {invoice.invoice_number}
                </Link>
              ) : (
                <Link href={`/dashboard/orders/${order.id}/invoice`} className="text-link">
                  View proforma invoice
                </Link>
              )}
            </p>
          </Section>
        </div>

        <Card as="aside" padded aria-label="Order summary" className="self-start">
          <p className="text-[13px] font-medium text-muted">Order summary</p>
          <h2 className="mt-2 font-display text-[22px] font-semibold tracking-[-0.02em] text-ink">{order.plan_name}</h2>
          <p className="mt-2 flex items-center gap-2 text-[14px] text-muted">
            <WindowsLogo size={15} />
            {order.product === "rdp" ? "Windows RDP" : "Windows VPS"}
          </p>
          <p className="mt-2 flex items-center gap-2 text-[14px] text-ink-2">
            {location && <CountryFlag iso2={location.iso2} />}
            {order.location_name}
          </p>
          <p className="num-tabular mt-2 text-[13px] leading-relaxed text-muted">{specLine(order.plan_specs)}</p>
          <SummaryList
            className="mt-5 border-t border-line"
            items={[
              { label: "Type", value: order.type === "renewal" ? "Renewal" : "New server" },
              { label: "Operating system", value: <WindowsOs size={14} /> },
              { label: "Term", value: `${order.term_days} days` },
              { label: "Price", value: formatUsd(order.list_price_cents, { cents: true }) },
              ...(order.discount_cents > 0
                ? [{ label: `Coupon${order.coupon_code ? ` ${order.coupon_code}` : ""}`, value: `−${formatUsd(order.discount_cents, { cents: true })}` }]
                : []),
              { label: "Total", value: <strong className="text-[16px]">{formatUsd(order.total_cents, { cents: true })}</strong> },
            ]}
          />
          <p className="mt-5 border-t border-line pt-5 text-[13px] text-muted">
            Questions about this order?{" "}
            <Link href="/dashboard/tickets/new" className="text-link">
              Contact support
            </Link>
          </p>
        </Card>
      </div>
    </>
  );
}
