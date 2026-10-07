import type { Metadata } from "next";
import Link from "next/link";
import { Ago, AdminHeader, CustomerLink, FilterBar, Mono, ResultCount } from "@/components/admin/parts";
import { DataTable, type Column } from "@/components/admin/data-table";
import { AdminBadge } from "@/components/admin/status";
import { VoidInvoice } from "@/components/admin/void-invoice";
import { FilterLinks, Pagination, pageParam, param, withParams } from "@/components/portal/list-controls";
import { requireConsole } from "@/lib/admin/guard";
import { listInvoices } from "@/lib/admin/queries";
import { isAdmin } from "@/lib/auth/session";
import { now } from "@/lib/clock";
import { formatUsd } from "@/lib/utils";

export const metadata: Metadata = { title: "Invoices" };

const VIEWS = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "void", label: "Void" },
] as const;

type Row = Awaited<ReturnType<typeof listInvoices>>["items"][number];

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireConsole();
  const admin = isAdmin(user);
  const sp = await searchParams;
  const view = VIEWS.find((v) => v.id === param(sp.view))?.id ?? "all";
  const q = param(sp.q)?.slice(0, 64);
  const page = pageParam(sp.page);
  const nowMs = now();
  const data = await listInvoices({ status: view === "all" ? undefined : view, q, page });

  const columns: Column<Row>[] = [
    {
      key: "number",
      header: "Invoice",
      cell: ({ invoice }) => (
        <Link href={`/dashboard/billing/invoices/${invoice.id}`} data-row-link className="font-semibold text-ink hover:text-lav-700">
          <Mono>{invoice.invoice_number}</Mono>
        </Link>
      ),
    },
    {
      key: "order",
      header: "Order",
      hide: "sm",
      cell: ({ invoice, orderNumber }) => (
        <Link href={`/admin/orders/${invoice.order_id}`} className="text-ink-2 hover:text-lav-700">
          <Mono>{orderNumber}</Mono>
        </Link>
      ),
    },
    { key: "customer", header: "Customer", hide: "md", cell: ({ customer }) => <CustomerLink customer={customer} showEmail className="max-w-[220px]" /> },
    { key: "total", header: "Total", align: "right", cell: ({ invoice }) => <span className="num-tabular font-medium text-ink">{formatUsd(invoice.total_cents, { cents: true })}</span> },
    {
      key: "status",
      header: "Status",
      cell: ({ invoice }) => (
        <span className="inline-flex flex-col items-start gap-1">
          <AdminBadge kind="invoice" status={invoice.status} />
          {invoice.void_reason && <span className="max-w-[200px] truncate text-[12px] text-muted">{invoice.void_reason}</span>}
        </span>
      ),
    },
    { key: "issued", header: "Issued", hide: "sm", cell: ({ invoice }) => <Ago value={invoice.issued_at} nowMs={nowMs} className="text-muted" /> },
    {
      key: "actions",
      header: "Actions",
      srOnlyHeader: true,
      align: "right",
      cell: ({ invoice }) =>
        admin && invoice.status === "paid" ? <VoidInvoice invoiceId={invoice.id} number={invoice.invoice_number} /> : null,
    },
  ];

  return (
    <>
      <AdminHeader title="Invoices" description="Issued automatically when a payment is approved. Open one to view or print it." />
      <FilterLinks label="Invoice status" current={view} hrefFor={(id) => withParams("/admin/invoices", { view: id === "all" ? null : id, q })} items={VIEWS.map((v) => ({ id: v.id, label: v.label }))} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar action="/admin/invoices" q={q} keep={{ view: view === "all" ? undefined : view }} placeholder="Invoice number or customer" />
        <ResultCount total={data.total} noun="invoice" />
      </div>
      <div>
        <DataTable rows={data.items} columns={columns} rowKey={(r) => r.invoice.id} label="Invoices" empty="No invoices match." />
      </div>
      <Pagination page={data.page} pageCount={data.pageCount} hrefFor={(n) => withParams("/admin/invoices", { view: view === "all" ? null : view, q, page: n })} />
    </>
  );
}
