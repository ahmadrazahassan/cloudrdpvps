import type { Metadata } from "next";
import Link from "next/link";
import { WindowsLogo } from "@/components/brand/windows-logo";
import { EmptyState } from "@/components/portal/empty-state";
import { FilterLinks, Pagination, pageParam, param, withParams } from "@/components/portal/list-controls";
import { LocalTime } from "@/components/portal/local-time";
import { PageHeader } from "@/components/portal/page-header";
import { StatusBadge } from "@/components/portal/status-badge";
import { CountryFlag } from "@/components/shared/primitives";
import { ButtonLink } from "@/components/ui/button";
import { getCatalog } from "@/lib/catalog";
import { needsPayment } from "@/lib/portal/derive";
import { listOrders, ORDER_FILTERS, type OrderFilter } from "@/lib/portal/queries";
import { formatUsd } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OrdersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = (ORDER_FILTERS.find((f) => f.id === param(sp.status))?.id ?? "all") as OrderFilter;
  const page = pageParam(sp.page);
  const [{ items, total, pageCount }, catalog] = await Promise.all([listOrders({ status, page }), getCatalog()]);
  const locationById = new Map(catalog.locations.map((l) => [l.id, l]));

  const base = "/dashboard/orders";
  return (
    <>
      <PageHeader
        title="Orders"
        description="Every order you've placed, and where it is in the process."
        actions={<ButtonLink href="/order/new">New order</ButtonLink>}
      />

      <FilterLinks
        label="Filter orders by status"
        items={ORDER_FILTERS}
        current={status}
        hrefFor={(id) => withParams(base, { status: id === "all" ? null : id })}
      />

      {items.length === 0 ? (
        status === "all" ? (
          <EmptyState
            image="empty-orders"
            title="No orders yet"
            body="When you place an order it shows up here, with its payment and delivery progress."
            action={<ButtonLink href="/order/new">Place your first order</ButtonLink>}
          />
        ) : (
          <EmptyState
            image="empty-search"
            title="No orders match"
            body="Try a different filter to see the rest."
            action={
              <ButtonLink href={base} variant="secondary">
                Show all orders
              </ButtonLink>
            }
          />
        )
      ) : (
        <>
          <p className="sr-only" role="status">
            {total} {total === 1 ? "order" : "orders"}
          </p>
          <div aria-hidden className="label-caps hidden grid-cols-[1.1fr_1.5fr_0.7fr_1fr_auto] gap-6 border-b border-line py-3 md:grid">
            <span>Order</span>
            <span>Plan</span>
            <span>Total</span>
            <span>Status</span>
            <span className="w-[88px]" />
          </div>
          <ul>
            {items.map((o) => {
              const loc = locationById.get(o.location_id);
              return (
                <li
                  key={o.id}
                  className="grid gap-x-6 gap-y-3 border-b border-line py-5 md:grid-cols-[1.1fr_1.5fr_0.7fr_1fr_auto] md:items-center"
                >
                  <div>
                    <Link href={`/dashboard/orders/${o.id}`} className="data-id text-[15px] font-semibold text-ink hover:text-lav-700">
                      {o.order_number}
                    </Link>
                    <p className="mt-0.5 text-[12px] text-muted">
                      <LocalTime value={o.created_at} dateOnly />
                      {o.type === "renewal" && " · Renewal"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <WindowsLogo size={16} title={o.product === "rdp" ? "Windows RDP" : "Windows VPS"} />
                    <span className="text-[14px] font-medium text-ink">{o.plan_name}</span>
                    {loc && (
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
                        <CountryFlag iso2={loc.iso2} />
                        {o.location_name}
                      </span>
                    )}
                  </div>
                  <p className="num-tabular text-[15px] font-medium text-ink">{formatUsd(o.total_cents, { cents: true })}</p>
                  <div>
                    <StatusBadge kind="order" status={o.status} />
                  </div>
                  <div className="md:w-[88px] md:text-right">
                    {needsPayment(o.status) ? (
                      <ButtonLink href={`/dashboard/orders/${o.id}/pay`} size="sm">
                        Pay now
                      </ButtonLink>
                    ) : (
                      <ButtonLink href={`/dashboard/orders/${o.id}`} variant="secondary" size="sm">
                        View
                      </ButtonLink>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} pageCount={pageCount} hrefFor={(p) => withParams(base, { status: status === "all" ? null : status, page: p })} />
        </>
      )}
    </>
  );
}
