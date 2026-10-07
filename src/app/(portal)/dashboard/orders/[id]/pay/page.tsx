import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WindowsLogo } from "@/components/brand/windows-logo";
import { Card } from "@/components/portal/cards";
import { Countdown } from "@/components/portal/countdown";
import { EmptyState } from "@/components/portal/empty-state";
import { PageHeader } from "@/components/portal/page-header";
import { PaymentFlow, type PayMethod } from "@/components/portal/payment-flow";
import { OrderSteps, checkoutSteps } from "@/components/shared/order-steps";
import { CountryFlag } from "@/components/shared/primitives";
import { SafeMarkdown } from "@/components/shared/safe-markdown";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";
import { now as clock } from "@/lib/clock";
import { getOrder, listPaymentMethods, signedUrl, type PaymentMethodRow } from "@/lib/portal/queries";
import { formatUsd } from "@/lib/utils";

export const metadata: Metadata = { title: "Pay for your order" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** [{label, value}] from the jsonb column, ignoring anything that isn't that shape. */
function parseDetails(json: unknown): { label: string; value: string }[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((d) => {
    const r = d as Record<string, unknown>;
    return typeof r?.label === "string" && typeof r?.value === "string" && r.value !== "" ? [{ label: r.label, value: r.value }] : [];
  });
}

async function toPayMethod(m: PaymentMethodRow): Promise<PayMethod> {
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    regions: (m.regions ?? []).map((r) => r.trim()),
    currencyCode: m.currency_code?.trim() || null,
    ratePerUsd: m.rate_per_usd,
    feeNote: m.fee_note,
    details: parseDetails(m.details),
    qrUrl: m.qr_path ? await signedUrl("method-qr", m.qr_path, 3600) : null,
    requiresReference: m.requires_reference,
    instructions: m.instructions_md ? <SafeMarkdown source={m.instructions_md} /> : null,
  };
}

export default async function PayPage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser(`/dashboard/orders/${id}/pay`);
  const data = await getOrder(id);
  if (!data) notFound();
  const { order, payments, service } = data;

  const now = clock();
  const expired = order.status === "awaiting_payment" && new Date(order.expires_at).getTime() <= now;
  const catalog = await getCatalog();
  const location = catalog.locations.find((l) => l.id === order.location_id);

  const summary = (
    <Card as="aside" padded aria-label="Order summary" className="lg:sticky lg:top-24 lg:self-start">
      <p className="text-[13px] font-medium text-muted">Order {order.order_number}</p>
      <h2 className="mt-2 font-display text-[22px] font-semibold tracking-[-0.02em] text-ink">{order.plan_name}</h2>
      <p className="mt-2 flex items-center gap-2 text-[14px] text-ink-2">
        {location && <CountryFlag iso2={location.iso2} />}
        {order.location_name} · {order.term_days} days
      </p>
      <div className="mt-5 rounded-card bg-lav-50 px-5 py-4">
        <p className="text-[13px] font-medium text-lav-800">Total due</p>
        <p className="num-tabular mt-2 font-display text-[34px] font-medium leading-none tracking-[-0.03em] text-ink">
          {formatUsd(order.total_cents, { cents: true })}
        </p>
        <p className="mt-1.5 text-[12px] text-ink-2">US dollars</p>
      </div>
      <p className="mt-4 flex items-center gap-2 text-[13px] text-muted">
        <WindowsLogo size={14} />
        Windows Server included
      </p>
      <p className="mt-5 border-t border-line pt-5 text-[13px]">
        <Link href={`/dashboard/orders/${order.id}`} className="text-link">
          View order details
        </Link>
      </p>
    </Card>
  );

  // ----- Not payable: say what happened and where to go next --------------------------------------------------
  if (expired || order.status === "cancelled") {
    return (
      <>
        <PageHeader title="This order can no longer be paid" />
        <EmptyState
          image="empty-orders"
          title={expired ? "This order expired" : "This order was cancelled"}
          body="Nothing was charged. Place a new order whenever you're ready."
          action={<ButtonLink href="/order/new">Place a new order</ButtonLink>}
        />
      </>
    );
  }

  if (order.status === "under_review") {
    return (
      <>
        <PageHeader title="We're reviewing your payment" description={`Order ${order.order_number}`} />
        <EmptyState
          image="status-under-review"
          title="Payment received"
          body="Our team is checking your proof against what we received. You'll get an email and a notification as soon as it's verified, and your server follows."
          action={<ButtonLink href={`/dashboard/orders/${order.id}`}>View order</ButtonLink>}
        />
      </>
    );
  }

  if (order.status === "approved" || order.status === "provisioning" || order.status === "completed" || order.status === "refunded") {
    return (
      <>
        <PageHeader title={order.status === "refunded" ? "This order was refunded" : "Payment verified"} description={`Order ${order.order_number}`} />
        <EmptyState
          image="success-order-placed"
          title={order.status === "completed" ? "Your server is ready" : order.status === "refunded" ? "Refund recorded" : "We're setting up your server"}
          body={
            order.status === "completed"
              ? "Your connection details are in your dashboard."
              : order.status === "refunded"
                ? "See the order for details."
                : "Your payment is verified. We'll notify you the moment the server is delivered."
          }
          action={
            <>
              <ButtonLink href={`/dashboard/orders/${order.id}`} variant={service ? "secondary" : "primary"}>
                View order
              </ButtonLink>
              {service && <ButtonLink href={`/dashboard/services/${service.id}`}>Open server</ButtonLink>}
            </>
          }
        />
      </>
    );
  }

  // ----- awaiting_payment / rejected: the payment flow --------------------------------------------------------
  const methods = await Promise.all((await listPaymentMethods()).map(toPayMethod));
  const sp = (await searchParams) ?? {};
  const rawMethod = Array.isArray(sp.method) ? sp.method[0] : sp.method;
  const initialMethodId = methods.find((m) => m.id === rawMethod)?.id;
  const rejected = payments.find((p) => p.status === "rejected");
  const rejectionMessage =
    order.status === "rejected"
      ? (rejected?.reject_message ?? rejected?.reject_reason ?? "We couldn't verify your payment. Please submit new proof.")
      : null;

  return (
    <>
      <PageHeader
        title="Pay for your order"
        description={
          <>
            Pay within{" "}
            <strong className="num-tabular font-semibold text-ink">
              <Countdown to={order.expires_at} serverNow={now} />
            </strong>{" "}
            or the order is cancelled automatically.
          </>
        }
      />
      <Card padded className="mb-5 py-7">
        <OrderSteps label="Checkout steps" steps={checkoutSteps("pay", { signedIn: true })} surface="card" className="mx-auto max-w-[760px]" />
      </Card>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <PaymentFlow
          orderId={order.id}
          orderNumber={order.order_number}
          totalCents={order.total_cents}
          defaultRegion={user.profile.billing_country?.trim() || null}
          methods={methods}
          rejectionMessage={rejectionMessage}
          initialMethodId={initialMethodId}
        />
        {summary}
      </div>
    </>
  );
}
