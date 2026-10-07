import type { Metadata } from "next";
import Link from "next/link";
import { Ago, AdminHeader, FilterBar, ResultCount } from "@/components/admin/parts";
import { DataTable, type Column } from "@/components/admin/data-table";
import { AdminBadge } from "@/components/admin/status";
import { FilterLinks, Pagination, pageParam, param, withParams } from "@/components/portal/list-controls";
import { requireConsole } from "@/lib/admin/guard";
import { listCustomers, type CustomerView } from "@/lib/admin/queries";
import { now } from "@/lib/clock";
import { formatUsd } from "@/lib/utils";

export const metadata: Metadata = { title: "Customers" };

const VIEWS: { id: CustomerView; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "suspended", label: "Suspended" },
];

type Row = Awaited<ReturnType<typeof listCustomers>>["items"][number];

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireConsole();
  const sp = await searchParams;
  const view = VIEWS.find((v) => v.id === param(sp.view))?.id ?? "all";
  const q = param(sp.q)?.slice(0, 64);
  const page = pageParam(sp.page);
  const nowMs = now();
  const data = await listCustomers({ view, q, page });

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Customer",
      cell: ({ profile }) => (
        <Link href={`/admin/customers/${profile.id}`} data-row-link className="block min-w-0 hover:text-lav-700">
          <span className="block max-w-[260px] truncate font-semibold text-ink">{profile.full_name.trim() || profile.email}</span>
          {profile.full_name.trim() && <span className="block max-w-[260px] truncate text-[12px] font-normal text-muted">{profile.email}</span>}
        </Link>
      ),
    },
    { key: "country", header: "Country", hide: "md", cell: ({ profile }) => <span className="text-ink-2">{profile.billing_country ?? "—"}</span> },
    { key: "status", header: "Status", cell: ({ profile }) => <AdminBadge kind="account" status={profile.status} /> },
    { key: "orders", header: "Orders", align: "right", hide: "sm", cell: ({ orders }) => <span className="num-tabular">{orders}</span> },
    { key: "active", header: "Active servers", align: "right", hide: "lg", cell: ({ active }) => <span className="num-tabular">{active}</span> },
    { key: "spend", header: "Lifetime spend", align: "right", hide: "md", cell: ({ spendCents }) => <span className="num-tabular font-medium text-ink">{formatUsd(spendCents)}</span> },
    { key: "joined", header: "Joined", align: "right", cell: ({ profile }) => <Ago value={profile.created_at} nowMs={nowMs} className="text-muted" /> },
  ];

  return (
    <>
      <AdminHeader title="Customers" description="Everyone with an account. Open one for their orders, servers, tickets and notes." />
      <FilterLinks label="Account status" current={view} hrefFor={(id) => withParams("/admin/customers", { view: id === "all" ? null : id, q })} items={VIEWS.map((v) => ({ id: v.id, label: v.label }))} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar action="/admin/customers" q={q} keep={{ view: view === "all" ? undefined : view }} placeholder="Name, email or phone" />
        <ResultCount total={data.total} noun="customer" />
      </div>
      <div>
        <DataTable rows={data.items} columns={columns} rowKey={(r) => r.profile.id} label="Customers" empty="No customers match." />
      </div>
      <Pagination page={data.page} pageCount={data.pageCount} hrefFor={(n) => withParams("/admin/customers", { view: view === "all" ? null : view, q, page: n })} />
    </>
  );
}
