/**
 * Built-in catalog: what the site shows before a backend is connected, and what supabase/seed.sql loads into a fresh database
 * (both come from src/content/launch.json). PRICES ARE PLACEHOLDERS — the owner edits them in Admin → Catalog → Pricing.
 * The homepage reads through `getCatalog()` (src/lib/catalog.ts); when the
 * Supabase backend lands only that function changes.
 */

import { slugify } from "@/lib/slug";
import { worldCountry } from "./world";
import launch from "./launch.json";

export type ProductType = "rdp" | "vps";
export type StockStatus = "in_stock" | "low" | "out_of_stock";

/** Skyline artwork exists for the first five locations only; every other country is shown by its flag. */
export type LocationImageKey = "loc-in" | "loc-bd" | "loc-us" | "loc-uk";

export interface Location {
  id: string;
  slug: string;
  name: string;
  /** ISO 3166-1 alpha-2, upper case. Any country in src/content/world.ts. */
  iso2: string;
  imageKey?: LocationImageKey;
  sortOrder: number;
}

export interface Plan {
  id: string;
  product: ProductType;
  slug: string;
  name: string;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  bandwidthTb: number;
  portMbps: number;
  features: string[];
  isFeatured: boolean;
  sortOrder: number;
}

export interface PlanPricing {
  planId: string;
  locationId: string;
  priceCents: number;
  stock: StockStatus;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: "bank" | "mobile_wallet" | "upi" | "crypto" | "other";
  /** ISO-2 codes; empty = international */
  regions: string[];
}

/**
 * The countries on sale at launch, from src/content/launch.json (most-asked-for first). Names come from the world list, addresses
 * from the name (united-states, hong-kong), and skyline artwork exists for the few that have it. Pakistan is not one of them.
 */
const SKYLINE: Record<string, NonNullable<Location["imageKey"]>> = { US: "loc-us", GB: "loc-uk", IN: "loc-in", BD: "loc-bd" };

export const locations: Location[] = launch.countries.map(([iso2], i) => {
  const name = worldCountry(iso2)!.name;
  const slug = slugify(name);
  return { id: slug, slug, name, iso2: iso2!, ...(SKYLINE[iso2!] ? { imageKey: SKYLINE[iso2!] } : {}), sortOrder: i + 1 };
});

const common = ["Full administrator access", "Windows Server included", "IPv4 address included"];

export const plans: Plan[] = [
  // ---- Windows RDP ----
  { id: "rdp-starter", product: "rdp", slug: "starter", name: "RDP Starter", vcpu: 2, ramGb: 4, storageGb: 60, bandwidthTb: 2, portMbps: 100, features: common, isFeatured: false, sortOrder: 1 },
  { id: "rdp-standard", product: "rdp", slug: "standard", name: "RDP Standard", vcpu: 4, ramGb: 8, storageGb: 120, bandwidthTb: 4, portMbps: 200, features: common, isFeatured: true, sortOrder: 2 },
  { id: "rdp-pro", product: "rdp", slug: "pro", name: "RDP Pro", vcpu: 6, ramGb: 16, storageGb: 200, bandwidthTb: 6, portMbps: 500, features: common, isFeatured: false, sortOrder: 3 },
  { id: "rdp-elite", product: "rdp", slug: "elite", name: "RDP Elite", vcpu: 8, ramGb: 32, storageGb: 300, bandwidthTb: 8, portMbps: 1000, features: common, isFeatured: false, sortOrder: 4 },
  // ---- Windows VPS ----
  { id: "vps-s", product: "vps", slug: "s", name: "VPS S", vcpu: 2, ramGb: 4, storageGb: 80, bandwidthTb: 3, portMbps: 200, features: common, isFeatured: false, sortOrder: 1 },
  { id: "vps-m", product: "vps", slug: "m", name: "VPS M", vcpu: 4, ramGb: 8, storageGb: 160, bandwidthTb: 5, portMbps: 500, features: common, isFeatured: true, sortOrder: 2 },
  { id: "vps-l", product: "vps", slug: "l", name: "VPS L", vcpu: 8, ramGb: 16, storageGb: 320, bandwidthTb: 8, portMbps: 1000, features: common, isFeatured: false, sortOrder: 3 },
  { id: "vps-xl", product: "vps", slug: "xl", name: "VPS XL", vcpu: 12, ramGb: 32, storageGb: 480, bandwidthTb: 12, portMbps: 1000, features: common, isFeatured: false, sortOrder: 4 },
];

/** USD per 30 days. PLACEHOLDERS by tier (src/content/launch.json): the owner sets real prices in Admin → Pricing & stock. */
export const pricing: PlanPricing[] = launch.countries.flatMap(([iso2, tier]) => {
  const location = locations.find((l) => l.iso2 === iso2)!;
  const row = launch.tiers[tier as "value" | "standard" | "premium"];
  return launch.plans.map((planKey, i) => ({
    planId: planKey.replace("/", "-"),
    locationId: location.id,
    priceCents: row[i]! * 100,
    stock: "in_stock" as StockStatus,
  }));
});

/**
 * Active payment methods. Per the backend seed, every method starts INACTIVE
 * until the owner fills in verified details — so the public list is empty and
 * the homepage shows generic method categories instead of named providers.
 */
export const paymentMethods: PaymentMethod[] = [];
