import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/parts";
import { CountriesManager, type CountryRow } from "@/components/admin/countries-manager";
import { WORLD } from "@/content/world";
import { requireAdminConsole } from "@/lib/admin/guard";
import { getCatalogAdmin } from "@/lib/admin/queries-system";

export const metadata: Metadata = { title: "Countries" };

export default async function CountriesPage() {
  await requireAdminConsole();
  const { plans, locations, pricing } = await getCatalogAdmin();

  const product = new Map(plans.filter((p) => p.is_active).map((p) => [p.id, p.product]));
  const location = new Map(locations.map((l) => [l.iso2.trim().toUpperCase(), l]));
  // lowest price on sale per location and product (only prices that are switched on, on plans that are on)
  const from = new Map<string, number>();
  for (const p of pricing) {
    const kind = product.get(p.plan_id);
    if (!kind || !p.is_active) continue;
    const key = `${p.location_id}:${kind}`;
    from.set(key, Math.min(from.get(key) ?? Infinity, p.price_cents));
  }

  const rows: CountryRow[] = WORLD.map((w) => {
    const loc = location.get(w.iso2);
    const rdpFrom = loc?.is_active ? (from.get(`${loc.id}:rdp`) ?? null) : null;
    const vpsFrom = loc?.is_active ? (from.get(`${loc.id}:vps`) ?? null) : null;
    return { iso2: w.iso2, name: w.name, region: w.region, rdp: rdpFrom !== null, vps: vpsFrom !== null, rdpFrom, vpsFrom };
  });

  const version = `${locations.length}:${pricing.length}:${[...locations.map((l) => l.updated_at), ...pricing.map((p) => p.updated_at)].reduce((m, t) => (t > m ? t : m), "")}`;
  const priceOptions = locations
    .filter((l) => l.is_active && pricing.some((p) => p.location_id === l.id && p.is_active))
    .map((l) => ({ id: l.id, name: l.name }));
  const ready = { rdp: plans.some((p) => p.is_active && p.product === "rdp"), vps: plans.some((p) => p.is_active && p.product === "vps") };

  return (
    <>
      <AdminHeader
        title="Countries"
        description="Choose where Windows RDP and Windows VPS are sold. Tick a country and it goes live on the site and in checkout straight away, priced like the location you pick below (fine-tune it on Pricing & stock). Untick it to hide it; nothing is deleted."
      />
      <CountriesManager rows={rows} version={version} priceOptions={priceOptions} ready={ready} />
    </>
  );
}
