import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/parts";
import { DataTable, type Column } from "@/components/admin/data-table";
import { PlanEditor } from "@/components/admin/editors";
import { AdminBadge } from "@/components/admin/status";
import { requireAdminConsole } from "@/lib/admin/guard";
import { getCatalogAdmin, type Plan } from "@/lib/admin/queries-system";
import { formatPort } from "@/lib/utils";

export const metadata: Metadata = { title: "Plans" };

export default async function PlansPage() {
  await requireAdminConsole();
  const { plans, pricing } = await getCatalogAdmin();
  const offered = new Map<string, number>();
  for (const p of pricing) if (p.is_active) offered.set(p.plan_id, (offered.get(p.plan_id) ?? 0) + 1);

  const columns: Column<Plan>[] = [
    {
      key: "name",
      header: "Plan",
      cell: (p) => (
        <span className="block min-w-0">
          <span className="block font-semibold text-ink">
            {p.name}
            {p.is_featured && <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.06em] text-lav-700">Featured</span>}
          </span>
          <span className="block text-[12px] text-muted">/{p.slug}</span>
        </span>
      ),
    },
    { key: "product", header: "Product", cell: (p) => <span className="font-medium">{p.product.toUpperCase()}</span> },
    {
      key: "specs",
      header: "Specs",
      hide: "md",
      cell: (p) => (
        <span className="num-tabular text-ink-2">
          {p.vcpu} vCPU · {p.ram_gb} GB · {p.storage_gb} GB NVMe · {p.bandwidth_tb} TB · {formatPort(p.port_mbps)}
        </span>
      ),
    },
    { key: "locations", header: "Locations", align: "right", hide: "sm", cell: (p) => <span className="num-tabular">{offered.get(p.id) ?? 0}</span> },
    { key: "state", header: "Status", cell: (p) => <AdminBadge kind="account" status={p.is_active ? "active" : "suspended"} className={p.is_active ? "" : ""} /> },
    { key: "edit", header: "Edit", srOnlyHeader: true, align: "right", cell: (p) => <PlanEditor plan={p} /> },
  ];

  return (
    <>
      <AdminHeader title="Plans" description="Spec templates shown on the public site. Windows is implied on every plan. Set prices and stock per location on the Pricing & stock page." actions={<PlanEditor />} />
      <DataTable rows={plans} columns={columns} rowKey={(p) => p.id} label="Plans" empty="No plans yet. Create the first one." />
    </>
  );
}
