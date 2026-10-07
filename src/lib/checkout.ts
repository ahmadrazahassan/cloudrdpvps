import type { Location, Plan, PlanPricing, ProductType } from "@/content/catalog";

/**
 * Checkout selection rules, shared by the server page (initial state from the URL)
 * and the client configurator (as the visitor changes things). Pure and tested.
 * Prices shown here are for display only — the database recomputes everything when
 * the order is placed.
 */
export interface CatalogSlice {
  locations: Location[];
  plans: Plan[];
  pricing: PlanPricing[];
}

export interface Selection {
  product: ProductType;
  locationSlug: string;
  planSlug: string;
}

const priceRow = (c: CatalogSlice, planId: string, locationId: string) =>
  c.pricing.find((p) => p.planId === planId && p.locationId === locationId);

/** Orderable = a price exists for this plan here and it isn't out of stock. */
export function isOrderable(c: CatalogSlice, planId: string, locationId: string): boolean {
  const row = priceRow(c, planId, locationId);
  return Boolean(row && row.stock !== "out_of_stock");
}

export const plansOf = (c: CatalogSlice, product: ProductType) => c.plans.filter((p) => p.product === product);

/** A location can be chosen for a product when at least one of its plans is orderable there. */
export const locationAvailable = (c: CatalogSlice, product: ProductType, locationId: string) =>
  plansOf(c, product).some((p) => isOrderable(c, p.id, locationId));

/**
 * Why a plan can't be chosen in a country — or that it can. The checkout shows the reason in plain words
 * instead of just greying the option out.
 */
export type Availability =
  | { ok: true; stock: "in_stock" | "low" }
  | { ok: false; reason: "not_offered" | "sold_out" };

export function planAvailability(c: CatalogSlice, planId: string, locationId: string): Availability {
  const row = priceRow(c, planId, locationId);
  if (!row) return { ok: false, reason: "not_offered" };
  if (row.stock === "out_of_stock") return { ok: false, reason: "sold_out" };
  return { ok: true, stock: row.stock };
}

/** The sentence that explains an unavailable plan in a country. */
export function whyPlanUnavailable(planName: string, countryName: string, a: Extract<Availability, { ok: false }>): string {
  return a.reason === "sold_out"
    ? `${planName} is out of stock in ${countryName} right now. Choose another plan, or another country.`
    : `${planName} isn't offered in ${countryName}. Choose another plan, or another country.`;
}

/** What a country offers for one product: how many plans can be ordered there, from what price, and why not if none. */
export interface CountryStatus {
  state: "available" | "low" | "sold_out" | "not_offered";
  orderable: number;
  from: number | null;
}

export function countryStatus(c: CatalogSlice, product: ProductType, locationId: string): CountryStatus {
  const plans = plansOf(c, product);
  const rows = plans.flatMap((p) => {
    const r = priceRow(c, p.id, locationId);
    return r ? [r] : [];
  });
  if (rows.length === 0) return { state: "not_offered", orderable: 0, from: null };
  const open = rows.filter((r) => r.stock !== "out_of_stock");
  if (open.length === 0) return { state: "sold_out", orderable: 0, from: null };
  return {
    state: open.every((r) => r.stock === "low") ? "low" : "available",
    orderable: open.length,
    from: Math.min(...open.map((r) => r.priceCents)),
  };
}

/**
 * Turn whatever the URL asked for into a valid selection, falling back sensibly:
 * unknown product → RDP; unavailable location → the first one with stock; unknown or
 * sold-out plan → the featured plan if available, else the first available.
 * `prefer` is a country code (a signed-in customer's billing country): used only when the URL names no country.
 */
export function resolveSelection(
  c: CatalogSlice,
  want: { product?: string | null; country?: string | null; plan?: string | null; prefer?: string | null },
): Selection | null {
  if (c.locations.length === 0 || c.plans.length === 0) return null;

  let product: ProductType = want.product === "vps" ? "vps" : "rdp";
  if (plansOf(c, product).length === 0) product = product === "rdp" ? "vps" : "rdp";
  const plans = plansOf(c, product);
  if (plans.length === 0) return null;

  const wantedLoc =
    c.locations.find((l) => l.slug === want.country) ??
    (!want.country && want.prefer ? c.locations.find((l) => l.iso2 === want.prefer!.trim().toUpperCase()) : undefined);
  const location =
    (wantedLoc && locationAvailable(c, product, wantedLoc.id) ? wantedLoc : undefined) ??
    c.locations.find((l) => locationAvailable(c, product, l.id)) ??
    wantedLoc ??
    c.locations[0]!;

  const wantedPlan = plans.find((p) => p.slug === want.plan);
  const plan =
    (wantedPlan && isOrderable(c, wantedPlan.id, location.id) ? wantedPlan : undefined) ??
    plans.find((p) => p.isFeatured && isOrderable(c, p.id, location.id)) ??
    plans.find((p) => isOrderable(c, p.id, location.id)) ??
    wantedPlan ??
    plans[0]!;

  return { product, locationSlug: location.slug, planSlug: plan.slug };
}

export type Step = "plan" | "account" | "review";
export const STEPS: readonly Step[] = ["plan", "account", "review"];

/**
 * The address of an exact configuration (and, optionally, the step being looked at). It is what the order page keeps in the
 * address bar, what a "sign in" or "confirm your email" round trip returns to, and what someone can copy to share.
 * Without a step it is the plain, shareable form — see landingStep for where that lands.
 */
export const orderPath = (s: Selection, step?: Step) =>
  `/order/new?product=${s.product}&country=${encodeURIComponent(s.locationSlug)}&plan=${encodeURIComponent(s.planSlug)}${step ? `&step=${step}` : ""}`;

/**
 * Where an address with no step lands. Someone who arrives with a plan AND a country already chosen has nothing left to
 * configure, so they go straight on (to the account step, or — already signed in — to review) with their choice shown and
 * changeable. Anyone else starts at the plan.
 */
export function landingStep(fullChoice: boolean, signedIn: boolean, renewing: boolean): Step {
  if (renewing || fullChoice) return signedIn ? "review" : "account";
  return "plan";
}

/**
 * Which step to actually show for the one in the URL. Someone who isn't signed in can't be on "review", and someone who is
 * has no need of "account" — so a pasted or stale link always lands on a step that makes sense.
 */
export function effectiveStep(want: string | null | undefined, signedIn: boolean, renewing: boolean, fullChoice = false): Step {
  if (renewing) return signedIn ? "review" : "account";
  const step = STEPS.find((s) => s === want);
  if (!step) return landingStep(fullChoice, signedIn, renewing);
  if (step === "plan") return "plan";
  return signedIn ? "review" : "account";
}
