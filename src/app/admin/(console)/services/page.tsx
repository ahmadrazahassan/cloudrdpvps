import type { Metadata } from "next";
import Link from "next/link";
import { Ago, AdminHeader, CustomerLink, FilterBar, Mono, ResultCount } from "@/components/admin/parts";
import { DataTable, type Column } from "@/components/admin/data-table";
import { AdminBadge } from "@/components/admin/status";
import { RulerMeter } from "@/components/ledger/ruler-meter";
import { CopyButton } from "@/components/portal/copy-button";
import { FilterLinks, Pagination, pageParam, param, withParams } from "@/components/portal/list-controls";
import { requireConsole } from "@/lib/admin/guard";
import { isServiceView, listServices, SERVICE_VIEWS, type ServiceView } from "@/lib/admin/queries";
import { now } from "@/lib/clock";
import { daysUntil } from "@/lib/format";
import type { Enums } from "@/types/database";

export const metadata: Metadata = { title: "Services" };

type Row = Awaited<ReturnType<typeof listServices>>["items"][number];

export default async function ServicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireConsole();
  const sp = await searchParams;
  const viewParam = param(sp.view);
  const view: ServiceView = isServiceView(viewParam) ? viewParam : "all";
  const q = param(sp.q)?.slice(0, 64);
  const productParam = param(sp.product);
  const product = productParam === "rdp" || productParam === "vps" ? (productParam as Enums<"product_type">) : undefined;
  const page = pageParam(sp.page);
  const nowMs = now();

  const data = await listServices({ view, product, q, page, nowMs });
  const keep = { view: view === "all" ? undefined : view, product, q };

  const columns: Column<Row>[] = [
    {
      key: "label",
      header: "Server",
      cell: ({ service }) => (
        <Link href={`/admin/services/${service.id}`} data-row-link className="block min-w-0 font-semibold text-ink hover:text-lav-700">
          <span className="block max-w-[220px] truncate">{service.label}</span>
          <span className="block text-[12px] font-normal text-muted">
            {service.product.toUpperCase()} · {service.plan_name}
          </span>
        </Link>
      ),
    },
    { key: "customer", header: "Customer", hide: "md", cell: ({ customer }) => <CustomerLink customer={customer} showEmail className="max-w-[220px]" /> },
    {
      key: "ip",
      header: "IP address",
      cell: ({ service }) => {
        const ip = String(service.ip).split("/")[0]!;
        return (
          <span className="inline-flex items-center gap-1">
            <Mono>{ip}</Mono>
            <CopyButton value={ip} label={`Copy ${ip}`} />
          </span>
        );
      },
    },
    { key: "status", header: "Status", cell: ({ service }) => <AdminBadge kind="service" status={service.status === "active" && Date.parse(service.expires_at) < nowMs ? "expired" : service.status} /> },
    {
      key: "term",
      header: "Time left",
      hide: "lg",
      className: "w-[180px]",
      cell: ({ service }) => <RulerMeter expiresAt={service.expires_at} daysLeft={daysUntil(service.expires_at, nowMs)} caption={false} className="w-[150px]" />,
    },
    { key: "expires", header: "Expires", align: "right", cell: ({ service }) => <Ago value={service.expires_at} nowMs={nowMs} className="text-muted" /> },
  ];

  return (
    <>
      <AdminHeader title="Services" description="Every server we have delivered. Open one to extend, suspend, change its login or terminate it." />
      <FilterLinks label="Service view" current={view} hrefFor={(id) => withParams("/admin/services", { view: id === "all" ? null : id, product, q })} items={SERVICE_VIEWS.map((v) => ({ id: v.id, label: v.label }))} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          action="/admin/services"
          q={q}
          keep={{ view: keep.view }}
          placeholder="Name, hostname, IP or customer"
          selects={[{ name: "product", label: "Product", all: "RDP & VPS", value: product, options: [{ value: "rdp", label: "RDP" }, { value: "vps", label: "VPS" }] }]}
        />
        <ResultCount total={data.total} noun="server" />
      </div>
      <div>
        <DataTable rows={data.items} columns={columns} rowKey={(r) => r.service.id} label="Services" empty="No servers match." />
      </div>
      <Pagination page={data.page} pageCount={data.pageCount} hrefFor={(n) => withParams("/admin/services", { ...keep, page: n })} />
    </>
  );
}
