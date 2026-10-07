"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/action";
import { worldCountry } from "@/content/world";
import { AppError, fromDbError } from "@/lib/errors";
import { CATALOG_TAG } from "@/lib/supabase/public";
import { slugify } from "@/lib/slug";
import { uuid } from "@/lib/validation";

const bust = () => {
  updateTag(CATALOG_TAG);
  revalidatePath("/", "layout");
};

const chunk = <T,>(rows: T[], size: number) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, i * size + size));

/**
 * Switch countries on or off for Windows RDP, Windows VPS or both — the one control behind Admin → Catalog → Countries.
 *
 * Switching ON creates the country's location if it doesn't exist yet and gives every plan of the chosen product a price there
 * (copied from the "price like" location, or the plan's cheapest existing price) so it can be ordered straight away; prices that
 * already exist are kept, only switched back on. Switching OFF hides those prices from the site and from checkout without deleting
 * them, and hides the location itself once neither product is on sale there. Each change is audited by the database.
 */
export const setCountryAvailability = action({
  name: "admin-set-country-availability",
  auth: "admin",
  rateLimit: { limit: 60, window: "1 h" },
  schema: z.object({
    countries: z.array(z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/)).min(1, "Choose at least one country.").max(250),
    products: z.array(z.enum(["rdp", "vps"])).min(1, "Choose RDP, VPS or both."),
    enabled: z.boolean(),
    priceLike: z.union([z.literal(""), uuid]).optional(),
  }),
  async handler({ countries, products, enabled, priceLike }, { supabase }) {
    const unknown = countries.filter((c) => !worldCountry(c));
    if (unknown.length) throw new AppError("VALIDATION", `Unknown country code: ${unknown.join(", ")}.`);
    const codes = [...new Set(countries)];

    const [locRes, planRes] = await Promise.all([
      supabase.from("locations").select("id, name, slug, iso2, sort_order, is_active"),
      supabase.from("plans").select("id, product, name, is_active").in("product", products),
    ]);
    if (locRes.error) throw fromDbError(locRes.error);
    if (planRes.error) throw fromDbError(planRes.error);
    const locations = locRes.data ?? [];
    const plans = (planRes.data ?? []).filter((p) => p.is_active);
    if (plans.length === 0) throw new AppError("VALIDATION", "There are no active plans for that product yet. Add plans first.");

    const byIso = new Map(locations.map((l) => [l.iso2.trim().toUpperCase(), l]));

    // ---- make sure every country being switched on has a location ----------------------------------------------
    const ids = new Map<string, string>(); // iso2 -> location id
    for (const c of codes) {
      const have = byIso.get(c);
      if (have) ids.set(c, have.id);
    }
    if (enabled) {
      const taken = new Set(locations.map((l) => l.slug));
      let order = locations.reduce((m, l) => Math.max(m, l.sort_order), 0);
      const fresh = codes
        .filter((c) => !ids.has(c))
        .map((c) => ({ c, w: worldCountry(c)! }))
        .sort((a, b) => a.w.name.localeCompare(b.w.name))
        .map(({ c, w }) => {
          let slug = slugify(w.name);
          for (let n = 2; taken.has(slug); n++) slug = `${slugify(w.name)}-${n}`;
          taken.add(slug);
          return { name: w.name, slug, iso2: c, sort_order: ++order, is_active: true };
        });
      for (const part of chunk(fresh, 100)) {
        const ins = await supabase.from("locations").insert(part).select("id, iso2");
        if (ins.error) throw fromDbError(ins.error);
        for (const row of ins.data ?? []) ids.set(row.iso2.trim().toUpperCase(), row.id);
      }
    }
    const locationIds = [...ids.values()];
    if (locationIds.length === 0) return { updated: 0, created: 0 };

    const planIds = plans.map((p) => p.id);

    if (!enabled) {
      // ---- OFF: hide this product's prices here, then hide any location with nothing left on sale ----------------
      const off = await supabase.from("plan_pricing").update({ is_active: false }).in("location_id", locationIds).in("plan_id", planIds);
      if (off.error) throw fromDbError(off.error);
      const still = await supabase.from("plan_pricing").select("location_id").in("location_id", locationIds).eq("is_active", true);
      if (still.error) throw fromDbError(still.error);
      const live = new Set((still.data ?? []).map((r) => r.location_id));
      const hide = locationIds.filter((id) => !live.has(id));
      if (hide.length) {
        const r = await supabase.from("locations").update({ is_active: false }).in("id", hide);
        if (r.error) throw fromDbError(r.error);
      }
      bust();
      return { updated: locationIds.length, created: 0 };
    }

    // ---- ON: reference prices ----------------------------------------------------------------------------------
    const allPricing = await supabase.from("plan_pricing").select("plan_id, location_id, price_cents, is_active");
    if (allPricing.error) throw fromDbError(allPricing.error);
    const pricing = allPricing.data ?? [];
    const cheapest = new Map<string, number>();
    for (const r of pricing) cheapest.set(r.plan_id, Math.min(cheapest.get(r.plan_id) ?? Infinity, r.price_cents));
    const like = new Map(pricing.filter((r) => priceLike && r.location_id === priceLike).map((r) => [r.plan_id, r.price_cents]));
    const referencePrice = (planId: string) => like.get(planId) ?? cheapest.get(planId);

    const missingPrice = plans.filter((p) => referencePrice(p.id) === undefined);
    if (missingPrice.length === plans.length) {
      throw new AppError("VALIDATION", "None of those plans has a price yet. Set prices on the Pricing & stock page first, then switch countries on.");
    }

    const target = new Set(locationIds);
    const have = new Set(pricing.filter((r) => target.has(r.location_id)).map((r) => `${r.plan_id}:${r.location_id}`));
    const insert = locationIds.flatMap((location_id) =>
      plans.flatMap((p) => {
        const price = referencePrice(p.id);
        return price === undefined || have.has(`${p.id}:${location_id}`) ? [] : [{ plan_id: p.id, location_id, price_cents: price, stock: "in_stock" as const, is_active: true }];
      }),
    );
    for (const part of chunk(insert, 300)) {
      const r = await supabase.from("plan_pricing").insert(part);
      if (r.error) throw fromDbError(r.error);
    }
    // prices that were already there are kept; just make sure they're on
    const on = await supabase.from("plan_pricing").update({ is_active: true }).in("location_id", locationIds).in("plan_id", planIds);
    if (on.error) throw fromDbError(on.error);
    const show = await supabase.from("locations").update({ is_active: true }).in("id", locationIds);
    if (show.error) throw fromDbError(show.error);

    bust();
    return { updated: locationIds.length, created: insert.length };
  },
});
