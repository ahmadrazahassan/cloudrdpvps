import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/parts";
import { DataTable, type Column } from "@/components/admin/data-table";
import { LocationEditor } from "@/components/admin/editors";
import { AdminBadge } from "@/components/admin/status";
import { requireAdminConsole } from "@/lib/admin/guard";
import { getCatalogAdmin, type Location } from "@/lib/admin/queries-system";

export const metadata: Metadata = { title: "Locations" };

export default async function LocationsPage() {
  await requireAdminConsole();
  const { locations, pricing } = await getCatalogAdmin();
  const active = new Map<string, number>();
  for (const p of pricing) if (p.is_active) active.set(p.location_id, (active.get(p.location_id) ?? 0) + 1);

  const columns: Column<Location>[] = [
    { key: "name", header: "Location", cell: (l) => <span className="block font-semibold text-ink">{l.name}<span className="block text-[12px] font-normal text-muted">/{l.slug}</span></span> },
    { key: "iso", header: "Country", cell: (l) => <span className="data-id font-medium">{l.iso2.trim()}</span> },
    { key: "prices", header: "Active prices", align: "right", hide: "sm", cell: (l) => <span className="num-tabular">{active.get(l.id) ?? 0}</span> },
    { key: "blurb", header: "Description", hide: "lg", cell: (l) => <span className="block max-w-[360px] truncate text-ink-2">{l.blurb ?? "—"}</span> },
    { key: "state", header: "Status", cell: (l) => <AdminBadge kind="account" status={l.is_active ? "active" : "suspended"} /> },
    { key: "edit", header: "Edit", srOnlyHeader: true, align: "right", cell: (l) => <LocationEditor location={l} activePricing={active.get(l.id) ?? 0} /> },
  ];

  return (
    <>
      <AdminHeader title="Locations" description="Where servers are hosted. Switching a location off hides it and its prices from the site and from checkout." actions={<LocationEditor />} />
      <DataTable rows={locations} columns={columns} rowKey={(l) => l.id} label="Locations" empty="No locations yet." />
    </>
  );
}
