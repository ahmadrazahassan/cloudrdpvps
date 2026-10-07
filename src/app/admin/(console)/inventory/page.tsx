import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { AdminHeader, FilterBar, Mono, ResultCount } from "@/components/admin/parts";
import { DataTable, type Column } from "@/components/admin/data-table";
import { AddInventory, ImportInventory, RetireItem } from "@/components/admin/inventory-forms";
import { AdminBadge } from "@/components/admin/status";
import { CopyButton } from "@/components/portal/copy-button";
import { FilterLinks, Pagination, pageParam, param, withParams } from "@/components/portal/list-controls";
import { requireAdminConsole } from "@/lib/admin/guard";
import type { InventoryItem } from "@/lib/admin/queries";
import { getCatalogAdmin, getInventory, getSettingsMap, getStockLevels } from "@/lib/admin/queries-system";
import { formatDate } from "@/lib/format";
import { formatUsd } from "@/lib/utils";

export const metadata: Metadata = { title: "Inventory" };

const VIEWS = [
  { id: "available", label: "Available" },
  { id: "allocated", label: "Allocated" },
  { id: "retired", label: "Retired" },
  { id: "all", label: "All" },
] as const;

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminConsole();
  const sp = await searchParams;
  const view = VIEWS.find((v) => v.id === param(sp.view))?.id ?? "available";
  const productParam = param(sp.product);
  const product = productParam === "rdp" || productParam === "vps" ? productParam : undefined;
  const page = pageParam(sp.page);

  const [data, catalog, levels, settings] = await Promise.all([
    getInventory({ status: view === "all" ? undefined : view, product, page }),
    getCatalogAdmin(),
    getStockLevels(),
    getSettingsMap(),
  ]);
  const threshold = typeof settings.low_stock_threshold === "number" ? settings.low_stock_threshold : 3;
  const locName = new Map(catalog.locations.map((l) => [l.id, l.name]));
  const planName = new Map(catalog.plans.map((p) => [p.id, p.name]));

  // every product + location that is for sale but has few (or no) servers on the shelf
  const offered = new Set(catalog.pricing.filter((p) => p.is_active).map((p) => `${catalog.plans.find((x) => x.id === p.plan_id)?.product}:${p.location_id}`));
  const low = [...offered]
    .filter((k) => !k.startsWith("undefined"))
    .map((k) => ({ key: k, have: levels.get(k) ?? 0 }))
    .filter((x) => x.have <= threshold)
    .sort((a, b) => a.have - b.have);

  const columns: Column<InventoryItem>[] = [
    {
      key: "ip",
      header: "Server",
      cell: (i) => {
        const ip = String(i.ip).split("/")[0]!;
        return (
          <span className="inline-flex items-center gap-1">
            <Mono className="font-semibold text-ink">{ip}{i.rdp_port !== 3389 ? `:${i.rdp_port}` : ""}</Mono>
            <CopyButton value={ip} label={`Copy ${ip}`} />
          </span>
        );
      },
    },
    { key: "what", header: "Product", cell: (i) => <span>{i.product.toUpperCase()} · {locName.get(i.location_id) ?? "—"}<span className="block text-[12px] text-muted">{i.plan_id ? planName.get(i.plan_id) ?? "—" : "Any plan"}</span></span> },
    { key: "supplier", header: "Supplier", hide: "md", cell: (i) => <span className="text-ink-2">{i.supplier ?? "—"}{i.supplier_ref && <span className="block text-[12px] text-muted">{i.supplier_ref}</span>}</span> },
    { key: "cost", header: "Cost", align: "right", hide: "lg", cell: (i) => (i.supplier_cost_cents != null ? <span className="num-tabular">{formatUsd(i.supplier_cost_cents, { cents: true })}</span> : <span className="text-muted">—</span>) },
    { key: "expires", header: "Supplier expiry", hide: "lg", cell: (i) => (i.supplier_expires_at ? formatDate(i.supplier_expires_at) : <span className="text-muted">—</span>) },
    { key: "status", header: "Status", cell: (i) => <AdminBadge kind="inventory" status={i.status} /> },
    { key: "actions", header: "Actions", srOnlyHeader: true, align: "right", cell: (i) => (i.status === "available" ? <RetireItem id={i.id} ip={String(i.ip).split("/")[0]!} /> : null) },
  ];

  return (
    <>
      <AdminHeader
        title="Inventory"
        description="Servers you've bought from suppliers and are holding for orders. Delivering from stock is one click on the order."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ImportInventory />
            <AddInventory locations={catalog.locations.map((l) => ({ value: l.id, label: l.name }))} plans={catalog.plans.map((p) => ({ value: p.id, label: `${p.product.toUpperCase()} ${p.name}` }))} />
          </div>
        }
      />

      {low.length > 0 && (
        <div role="status" className="rounded-panel bg-warn-bg px-6 py-4">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-warn">
            <TriangleAlert size={16} strokeWidth={1.75} aria-hidden /> Running low (≤ {threshold} available)
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[13.5px] text-ink-2">
            {low.map((l) => {
              const [prod, loc] = l.key.split(":");
              return (
                <li key={l.key}>
                  <span className="font-medium text-ink">{prod!.toUpperCase()} · {locName.get(loc!) ?? "—"}</span>: <span className="num-tabular">{l.have}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <FilterLinks label="Stock status" current={view} hrefFor={(id) => withParams("/admin/inventory", { view: id === "available" ? null : id, product })} items={VIEWS.map((v) => ({ id: v.id, label: v.label }))} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar action="/admin/inventory" keep={{ view: view === "available" ? undefined : view }} placeholder="Filter" selects={[{ name: "product", label: "Product", all: "RDP & VPS", value: product, options: [{ value: "rdp", label: "RDP" }, { value: "vps", label: "VPS" }] }]} />
        <ResultCount total={data.total} noun="server" />
      </div>
      <DataTable rows={data.items} columns={columns} rowKey={(i) => i.id} label="Inventory" empty="No servers in stock. Add one, or import a CSV." />
      <Pagination page={data.page} pageCount={data.pageCount} hrefFor={(n) => withParams("/admin/inventory", { view: view === "available" ? null : view, product, page: n })} />
    </>
  );
}
