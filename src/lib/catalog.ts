import { cache } from "react";
import {
  locations,
  paymentMethods,
  plans,
  pricing,
  type Location,
  type PaymentMethod,
  type Plan,
  type PlanPricing,
  type ProductType,
} from "@/content/catalog";
import { worldCountry } from "@/content/world";
import { mapCatalog } from "@/lib/catalog-mapper";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";

export type { Location, PaymentMethod, Plan, PlanPricing, ProductType };

export interface Catalog {
  locations: Location[];
  plans: Plan[];
  pricing: PlanPricing[];
  paymentMethods: PaymentMethod[];
}

function seedCatalog(): Catalog {
  return {
    locations: [...locations].sort((a, b) => a.sortOrder - b.sortOrder),
    plans: [...plans].sort((a, b) => a.sortOrder - b.sortOrder),
    pricing,
    paymentMethods,
  };
}

async function fetchCatalog(): Promise<Catalog> {
  const db = createPublicClient();
  const [l, p, pp, pm] = await Promise.all([
    db.from("locations").select("*").eq("is_active", true).order("sort_order"),
    db.from("plans").select("*").eq("is_active", true).order("sort_order"),
    db.from("plan_pricing").select("*").eq("is_active", true),
    db.from("payment_methods_public").select("*").order("sort_order"),
  ]);
  const failed = [l, p, pp, pm].find((r) => r.error);
  // A broken catalog must be loud: silently showing seed prices could disagree with what checkout charges.
  if (failed?.error) throw new Error(`Catalog query failed: ${failed.error.message}`);
  return mapCatalog({
    locations: l.data ?? [],
    plans: p.data ?? [],
    pricing: pp.data ?? [],
    paymentMethods: pm.data ?? [],
  });
}

let warned = false;

/**
 * Single data-access point for public catalog reads (plans, prices, locations,
 * active payment-method names).
 *
 * - Supabase configured -> live data through a cookie-less client whose GETs are
 *   cached for 5 minutes and tagged `catalog`; admin edits call `updateTag("catalog")`
 *   so changes show immediately.
 * - Not configured      -> the bundled seed (src/content/catalog.ts), so a fresh
 *   checkout still renders a complete homepage.
 * Memoised per request so the many sections on the homepage share one fetch.
 */
export const getCatalog = cache(async (): Promise<Catalog> => {
  if (!isSupabaseConfigured) {
    if (!warned && process.env.NODE_ENV === "production") {
      warned = true;
      console.warn("[catalog] Supabase is not configured — serving built-in seed data.");
    }
    return seedCatalog();
  }
  return fetchCatalog();
});

export function priceFor(
  catalog: Pick<Catalog, "pricing">,
  planId: string,
  locationId: string,
) {
  return catalog.pricing.find(
    (p) => p.planId === planId && p.locationId === locationId,
  );
}

/** Lowest price (cents) for a product, optionally within one location. */
export function minPriceCents(
  catalog: Catalog,
  product: ProductType,
  locationId?: string,
): number | null {
  const planIds = new Set(
    catalog.plans.filter((p) => p.product === product).map((p) => p.id),
  );
  const rows = catalog.pricing.filter(
    (p) =>
      planIds.has(p.planId) &&
      p.stock !== "out_of_stock" &&
      (!locationId || p.locationId === locationId),
  );
  if (rows.length === 0) return null;
  return Math.min(...rows.map((r) => r.priceCents));
}

/** One row per country for the searchable directory: its real name, region and what each product starts at. */
export function directoryItems(catalog: Catalog) {
  return catalog.locations.map((l) => ({
    slug: l.slug,
    name: l.name,
    iso2: l.iso2,
    region: worldCountry(l.iso2)?.region ?? "Other",
    rdp: minPriceCents(catalog, "rdp", l.id),
    vps: minPriceCents(catalog, "vps", l.id),
  }));
}

/**
 * "Pakistan, India and Bangladesh" for a handful of locations, "42 countries" for many — so copy that names where we sell
 * stays right however many countries the owner has switched on.
 */
export function placesPhrase(locations: Pick<Location, "name">[], max = 5): string {
  const names = locations.map((l) => l.name);
  if (names.length === 0) return "countries around the world";
  if (names.length <= max) return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${names.length} countries`;
}

export function plansFor(catalog: Catalog, product: ProductType) {
  return catalog.plans.filter((p) => p.product === product);
}

/** Aggregate ranges across all plans (or one product's plans) — used for spec panels and comparisons. */
export function specRanges(catalog: Catalog, product?: ProductType) {
  const p = product ? catalog.plans.filter((x) => x.product === product) : catalog.plans;
  const range = (f: (x: Plan) => number) => [
    Math.min(...p.map(f)),
    Math.max(...p.map(f)),
  ] as const;
  return {
    vcpu: range((x) => x.vcpu),
    ramGb: range((x) => x.ramGb),
    storageGb: range((x) => x.storageGb),
    bandwidthTb: range((x) => x.bandwidthTb),
    portMbps: range((x) => x.portMbps),
  };
}
