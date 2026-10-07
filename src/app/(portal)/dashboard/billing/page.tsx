import type { Metadata } from "next";
import Link from "next/link";
import { Card, Row, RowList, TableHead, Tabs } from "@/components/portal/cards";
import { EmptyState } from "@/components/portal/empty-state";
import { param } from "@/components/portal/list-controls";
import { LocalTime } from "@/components/portal/local-time";
import { PageHeader } from "@/components/portal/page-header";
import { StatusBadge } from "@/components/portal/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { getOrderNumbers, listInvoices, listPayments } from "@/lib/portal/queries";
import { formatUsd } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function BillingPage({ searchParams }: Props) {
  const tab = param((await searchParams).tab) === "payments" ? "payments" : "invoices";
  const [invoices, payments, orderNumbers] = await Promise.all([listInvoices(), listPayments(), getOrderNumbers()]);

  return (
    <>
      <PageHeader title="Billing" description="Invoices for paid orders, and every payment you've submitted." />

      <Tabs
        className="mb-5"
        label="Billing sections"
        current={tab}
        items={[
          { id: "invoices", label: "Invoices", count: invoices.length },
          { id: "payments", label: "Payments", count: payments.length },
        ]}
        hrefFor={(id) => (id === "invoices" ? "/dashboard/billing" : `/dashboard/billing?tab=${id}`)}
      />

      {tab === "invoices" ? (
        invoices.length === 0 ? (
          <EmptyState
            image="empty-orders"
            title="No invoices yet"
            body="An invoice is created automatically once a payment is verified."
            action={
              <ButtonLink href="/dashboard/orders" variant="secondary">
                View orders
              </ButtonLink>
            }
          />
        ) : (
          <Card>
            <TableHead className="md:grid-cols-[1.2fr_1fr_1fr_0.8fr_auto]">
              <span>Invoice</span>
              <span>Date</span>
              <span>Order</span>
              <span>Amount</span>
              <span className="w-[120px]" />
            </TableHead>
            <RowList className="border-t border-line md:border-t-0">
              {invoices.map((inv) => (
                <Row key={inv.id} className="md:grid-cols-[1.2fr_1fr_1fr_0.8fr_auto]">
                  <div className="flex items-center gap-3">
                    <Link href={`/dashboard/billing/invoices/${inv.id}`} className="data-id text-[15px] font-semibold text-ink hover:text-lav-700">
                      {inv.invoice_number}
                    </Link>
                    {inv.status === "void" && (
                      <span className="rounded-badge bg-bad-bg px-2.5 py-1.5 text-[12px] font-medium leading-none text-bad-ink">Void</span>
                    )}
                  </div>
                  <p className="text-[14px] text-ink-2">
                    <LocalTime value={inv.issued_at} dateOnly />
                  </p>
                  <p className="data-id text-[14px] text-ink-2">{orderNumbers.get(inv.order_id) ?? "—"}</p>
                  <p className="num-tabular text-[15px] font-medium text-ink">{formatUsd(inv.total_cents, { cents: true })}</p>
                  <div className="md:w-[120px] md:text-right">
                    <ButtonLink href={`/dashboard/billing/invoices/${inv.id}`} variant="secondary" size="sm">
                      View / Print
                    </ButtonLink>
                  </div>
                </Row>
              ))}
            </RowList>
          </Card>
        )
      ) : payments.length === 0 ? (
        <EmptyState image="empty-orders" title="No payments yet" body="Payments you submit for your orders are listed here." />
      ) : (
        <Card>
          <TableHead className="md:grid-cols-[1fr_1fr_1.3fr_0.8fr_1fr]">
            <span>Date</span>
            <span>Order</span>
            <span>Method</span>
            <span>Amount</span>
            <span>Status</span>
          </TableHead>
          <RowList className="border-t border-line md:border-t-0">
            {payments.map((p) => (
              <Row key={p.id} className="md:grid-cols-[1fr_1fr_1.3fr_0.8fr_1fr]">
                <p className="text-[14px] text-ink-2">
                  <LocalTime value={p.created_at} dateOnly />
                </p>
                <Link href={`/dashboard/orders/${p.order_id}`} className="data-id text-[14px] font-semibold text-ink hover:text-lav-700">
                  {orderNumbers.get(p.order_id) ?? "Order"}
                </Link>
                <div>
                  <p className="text-[14px] text-ink">{p.method_name}</p>
                  {p.reference && <p className="data-id text-[12px] text-muted">Ref {p.reference}</p>}
                </div>
                <p className="num-tabular text-[15px] font-medium text-ink">{formatUsd(p.amount_usd_cents, { cents: true })}</p>
                <div>
                  <StatusBadge kind="payment" status={p.status} />
                </div>
              </Row>
            ))}
          </RowList>
        </Card>
      )}
    </>
  );
}
