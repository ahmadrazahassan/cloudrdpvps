import type { Location, LocationImageKey, PaymentMethod, Plan, PlanPricing } from "@/content/catalog";
import type { Tables, Views } from "@/types/database";

export interface CatalogRows {
  locations: Tables<"locations">[];
  plans: Tables<"plans">[];
  pricing: Tables<"plan_pricing">[];
  paymentMethods: Views<"payment_methods_public">[];
}

/** The countries that have skyline artwork. Everything else renders with its flag. */
const IMAGE_BY_ISO: Record<string, LocationImageKey> = {
  IN: "loc-in",
  BD: "loc-bd",
  US: "loc-us",
  GB: "loc-uk",
};
const IMAGE_KEYS = new Set<string>(Object.values(IMAGE_BY_ISO));

/** The names the first launch used; shown as the country's real name instead. */
const SHORT_NAMES: Record<string, string> = { USA: "United States", UK: "United Kingdom" };

/**
 * Database rows -> the shapes the site renders. Defensive on purpose: a price
 * row for a plan or location that isn't live (or doesn't exist) is dropped, and
 * a location whose country code isn't two letters is skipped rather than crashing
 * the homepage.
 */
export function mapCatalog(rows: CatalogRows) {
  const locations: Location[] = [];
  for (const l of rows.locations.filter((x) => x.is_active)) {
    const iso2 = l.iso2.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(iso2)) continue;
    const art = l.image_key && IMAGE_KEYS.has(l.image_key) ? (l.image_key as LocationImageKey) : IMAGE_BY_ISO[iso2];
    locations.push({
      id: l.id,
      slug: l.slug,
      name: SHORT_NAMES[l.name] ?? l.name,
      iso2,
      ...(art ? { imageKey: art } : {}),
      sortOrder: l.sort_order,
    });
  }
  locations.sort((a, b) => a.sortOrder - b.sortOrder);

  const plans: Plan[] = rows.plans
    .filter((p) => p.is_active)
    .map((p) => ({
      id: p.id,
      product: p.product,
      slug: p.slug,
      name: p.name,
      vcpu: p.vcpu,
      ramGb: p.ram_gb,
      storageGb: p.storage_gb,
      bandwidthTb: Number(p.bandwidth_tb),
      portMbps: p.port_mbps,
      features: p.features,
      isFeatured: p.is_featured,
      sortOrder: p.sort_order,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const livePlans = new Set(plans.map((p) => p.id));
  const liveLocations = new Set(locations.map((l) => l.id));
  const pricing: PlanPricing[] = rows.pricing
    .filter((p) => p.is_active && livePlans.has(p.plan_id) && liveLocations.has(p.location_id))
    .map((p) => ({ planId: p.plan_id, locationId: p.location_id, priceCents: p.price_cents, stock: p.stock }));

  const paymentMethods: PaymentMethod[] = [];
  for (const m of rows.paymentMethods) {
    if (!m.id || !m.name || !m.type) continue;
    paymentMethods.push({ id: m.id, name: m.name, type: m.type, regions: (m.regions ?? []).map((r) => r.trim()) });
  }

  return { locations, plans, pricing, paymentMethods };
}
