import type { Metadata } from "next";
import Link from "next/link";
import { Ago, AdminHeader, CustomerLink, FilterBar, Mono, ResultCount } from "@/components/admin/parts";
import { DataTable, type Column } from "@/components/admin/data-table";
import { AdminBadge } from "@/components/admin/status";
import { FilterLinks, Pagination, pageParam, param, withParams } from "@/components/portal/list-controls";
import { requireConsole } from "@/lib/admin/guard";
import { listOrders } from "@/lib/admin/queries";
import { now } from "@/lib/clock";
import { formatUsd } from "@/lib/utils";
import type { Enums } from "@/types/database";

export const metadata: Metadata = { title: "Orders" };

const VIEWS = [
  { id: "all", label: "All" },
  { id: "allocate", label: "To allocate" },
  { id: "under_review", label: "Under review" },
  { id: "awaiting_payment", label: "Awaiting payment" },
  { id: "completed", label: "Completed" },
  { id: "closed", label: "Cancelled & refunded" },
] as const;

type Row = Awaited<ReturnType<typeof listOrders>>["items"][number];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireConsole();
  const sp = await searchParams;
  const view = VIEWS.find((v) => v.id === param(sp.view))?.id ?? "all";
  const q = param(sp.q)?.slice(0, 64);
  const type = param(sp.type) === "new" || param(sp.type) === "renewal" ? (param(sp.type) as Enums<"order_type">) : undefined;
  const product = param(sp.product) === "rdp" || param(sp.product) === "vps" ? (param(sp.product) as Enums<"product_type">) : undefined;
  const page = pageParam(sp.page);
  const nowMs = now();

  const data = await listOrders({
    page,
    q,
    type,
    product,
    allocate: view === "allocate",
    status: view === "under_review" || view === "awaiting_payment" || view === "completed" ? view : undefined,
  });
  // "closed" spans two statuses, so it is filtered after the query (the set is small by nature).
  const items = view === "closed" ? data.items.filter((i) => i.order.status === "cancelled" || i.order.status === "refunded") : data.items;

  const keep = { view: view === "all" ? undefined : view, type, product, q };
  const columns: Column<Row>[] = [
    {
      key: "order",
      header: "Order",
      cell: ({ order }) => (
        <Link href={`/admin/orders/${order.id}`} data-row-link className="block font-semibold text-ink hover:text-lav-700">
          <Mono>{order.order_number}</Mono>
          {order.type === "renewal" && <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Renewal</span>}
        </Link>
      ),
    },
    { key: "customer", header: "Customer", cell: ({ customer }) => <CustomerLink customer={customer} showEmail className="max-w-[220px]" /> },
    {
      key: "plan",
      header: "Plan",
      hide: "md",
      cell: ({ order }) => (
        <span className="block min-w-0">
          <span className="block truncate text-ink">{order.plan_name}</span>
          <span className="block truncate text-[12px] text-muted">
            {order.product.toUpperCase()} · {order.location_name}
          </span>
        </span>
      ),
    },
    { key: "total", header: "Total", align: "right", cell: ({ order }) => <span className="num-tabular font-medium text-ink">{formatUsd(order.total_cents)}</span> },
    { key: "status", header: "Status", cell: ({ order }) => <AdminBadge kind="order" status={order.status} /> },
    { key: "payment", header: "Payment", hide: "lg", cell: ({ payment }) => (payment ? <AdminBadge kind="payment" status={payment} /> : <span className="text-muted">No proof</span>) },
    { key: "placed", header: "Placed", hide: "sm", cell: ({ order }) => <Ago value={order.created_at} nowMs={nowMs} className="text-muted" /> },
  ];

  return (
    <>
      <AdminHeader title="Orders" description="Every order, new and renewal. Open one to see its payments, timeline and to deliver the server." />
      <FilterLinks label="Order view" current={view} hrefFor={(id) => withParams("/admin/orders", { view: id === "all" ? null : id, type, product, q })} items={VIEWS.map((v) => ({ id: v.id, label: v.label }))} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          action="/admin/orders"
          q={q}
          keep={{ view: keep.view }}
          placeholder="Order number, plan or customer"
          selects={[
            { name: "type", label: "Type", all: "All types", value: type, options: [{ value: "new", label: "New" }, { value: "renewal", label: "Renewal" }] },
            { name: "product", label: "Product", all: "RDP & VPS", value: product, options: [{ value: "rdp", label: "RDP" }, { value: "vps", label: "VPS" }] },
          ]}
        />
        <ResultCount total={view === "closed" ? items.length : data.total} noun="order" />
      </div>
      <div>
        <DataTable rows={items} columns={columns} rowKey={(r) => r.order.id} label="Orders" empty="No orders match." />
      </div>
      <Pagination page={data.page} pageCount={data.pageCount} hrefFor={(n) => withParams("/admin/orders", { ...keep, page: n })} />
    </>
  );
}
