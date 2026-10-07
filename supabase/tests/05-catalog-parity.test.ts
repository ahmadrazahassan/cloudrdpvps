import { afterAll, beforeAll, describe, expect, it } from "vitest";
import launch from "@/content/launch.json";
import { locations as seedLocations, plans as seedPlans, pricing as seedPricing } from "@/content/catalog";
import { mapCatalog, type CatalogRows } from "@/lib/catalog-mapper";
import { createDb, type Db } from "./harness";

describe("seed.sql ⇄ src/content/catalog.ts ⇄ mapCatalog", () => {
  let db: Db;
  let rows: CatalogRows;
  beforeAll(async () => {
    db = await createDb();
    const q = async (sql: string) => (await db.query<any>(sql)).rows;
    rows = {
      locations: await q("select * from public.locations"),
      plans: await q("select * from public.plans"),
      pricing: await q("select * from public.plan_pricing"),
      paymentMethods: await q("select * from public.payment_methods_public"),
    };
  });
  afterAll(async () => {
    await db.close();
  });

  it("maps the live seed to the shapes the homepage renders", () => {
    const c = mapCatalog(rows);
    expect(c.locations).toHaveLength(launch.countries.length);
    expect(c.plans).toHaveLength(8);
    expect(c.pricing).toHaveLength(launch.countries.length * 8);
    expect(c.paymentMethods).toEqual([]); // every method is seeded inactive
    expect(c.locations.map((l) => l.iso2)).toEqual(launch.countries.map(([iso2]) => iso2));
    expect(c.locations.some((l) => l.iso2 === "PK")).toBe(false); // we do not host in Pakistan
    // skyline artwork exists for four of them; the rest are shown by their flag
    expect(c.locations.filter((l) => l.imageKey).map((l) => l.iso2).sort()).toEqual(["BD", "GB", "IN", "US"]);
    for (const p of c.plans) {
      expect(typeof p.bandwidthTb).toBe("number");
      expect(Number.isFinite(p.bandwidthTb)).toBe(true);
    }
  });

  it("matches the static fallback seed exactly (specs, features, featured flag, every price)", () => {
    const c = mapCatalog(rows);
    expect(c.locations.map((l) => [l.slug, l.name, l.iso2, l.sortOrder])).toEqual(
      seedLocations.map((l) => [l.slug, l.name, l.iso2, l.sortOrder]),
    );

    for (const sp of seedPlans) {
      const p = c.plans.find((x) => x.product === sp.product && x.slug === sp.slug);
      expect(p, `${sp.product}/${sp.slug} missing from the database seed`).toBeDefined();
      expect({ ...p!, id: "" }).toEqual({ ...sp, id: "" });
    }

    for (const sp of seedPricing) {
      const plan = seedPlans.find((x) => x.id === sp.planId)!;
      const loc = seedLocations.find((x) => x.id === sp.locationId)!;
      const dbPlan = c.plans.find((x) => x.product === plan.product && x.slug === plan.slug)!;
      const dbLoc = c.locations.find((x) => x.slug === loc.slug)!;
      const row = c.pricing.find((x) => x.planId === dbPlan.id && x.locationId === dbLoc.id);
      expect(row, `no price for ${plan.name} in ${loc.name}`).toBeDefined();
      expect({ cents: row!.priceCents, stock: row!.stock }).toEqual({ cents: sp.priceCents, stock: sp.stock });
    }
  });

  it("hides inactive plans/locations and the prices that depend on them", () => {
    const planOff = rows.plans[0]!.id;
    const locOff = rows.locations[0]!.id;
    const c = mapCatalog({
      ...rows,
      plans: rows.plans.map((p) => (p.id === planOff ? { ...p, is_active: false } : p)),
      locations: rows.locations.map((l) => (l.id === locOff ? { ...l, is_active: false } : l)),
    });
    expect(c.plans.find((p) => p.id === planOff)).toBeUndefined();
    expect(c.locations.find((l) => l.id === locOff)).toBeUndefined();
    expect(c.pricing.some((p) => p.planId === planOff || p.locationId === locOff)).toBe(false);
    expect(c.pricing).toHaveLength(7 * (launch.countries.length - 1));
  });

  it("skips a location with a malformed country code instead of crashing, and exposes active payment methods only by safe fields", () => {
    const c = mapCatalog({
      ...rows,
      locations: [...rows.locations, { ...rows.locations[0]!, id: "x", slug: "narnia", iso2: "Z1" }],
      paymentMethods: [{ id: "m1", name: "UPI", type: "upi", regions: ["IN"], sort_order: 1 }],
    });
    expect(c.locations.some((l) => l.slug === "narnia")).toBe(false);
    expect(c.paymentMethods).toEqual([{ id: "m1", name: "UPI", type: "upi", regions: ["IN"] }]);
  });
});
