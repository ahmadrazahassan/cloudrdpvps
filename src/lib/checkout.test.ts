import { describe, expect, it } from "vitest";
import { locations, plans, pricing } from "@/content/catalog";
import { countryStatus, effectiveStep, isOrderable, locationAvailable, orderPath, planAvailability, resolveSelection, whyPlanUnavailable, type CatalogSlice } from "./checkout";

const seed: CatalogSlice = { locations, plans, pricing };
const withStock = (patch: (p: (typeof pricing)[number]) => (typeof pricing)[number]): CatalogSlice => ({
  ...seed,
  pricing: pricing.map(patch),
});

describe("resolveSelection", () => {
  it("keeps a valid request as asked", () => {
    expect(resolveSelection(seed, { product: "vps", country: "united-kingdom", plan: "l" })).toEqual({
      product: "vps",
      locationSlug: "united-kingdom",
      planSlug: "l",
    });
  });

  it("defaults to RDP, the first location and the featured plan", () => {
    expect(resolveSelection(seed, {})).toEqual({ product: "rdp", locationSlug: "united-states", planSlug: "standard" });
  });

  it("repairs nonsense from the URL", () => {
    const s = resolveSelection(seed, { product: "mainframe", country: "atlantis", plan: "nope" });
    expect(s).toEqual({ product: "rdp", locationSlug: "united-states", planSlug: "standard" });
  });

  it("does not carry a plan slug across products", () => {
    // "starter" exists for RDP only; asking for it on VPS falls back to VPS's featured plan.
    expect(resolveSelection(seed, { product: "vps", country: "india", plan: "starter" })?.planSlug).toBe("m");
  });

  it("skips a sold-out plan", () => {
    const c = withStock((p) => (p.planId === "rdp-standard" && p.locationId === "india" ? { ...p, stock: "out_of_stock" } : p));
    expect(resolveSelection(c, { product: "rdp", country: "india", plan: "standard" })?.planSlug).toBe("starter");
  });

  it("moves to a location with stock when the requested one is sold out for the product", () => {
    const c = withStock((p) =>
      p.locationId === "united-states" && p.planId.startsWith("rdp-") ? { ...p, stock: "out_of_stock" } : p,
    );
    expect(resolveSelection(c, { product: "rdp", country: "united-states" })?.locationSlug).toBe("united-kingdom");
    // …but VPS in the United States is unaffected.
    expect(resolveSelection(c, { product: "vps", country: "united-states" })?.locationSlug).toBe("united-states");
  });

  it("returns null when there is nothing to sell", () => {
    expect(resolveSelection({ locations: [], plans, pricing }, {})).toBeNull();
    expect(resolveSelection({ locations, plans: [], pricing }, {})).toBeNull();
  });
});

describe("availability", () => {
  it("treats a missing price row or out-of-stock row as not orderable", () => {
    expect(isOrderable(seed, "rdp-pro", "united-states")).toBe(true);
    expect(isOrderable({ ...seed, pricing: [] }, "rdp-pro", "united-states")).toBe(false);
    const sold = withStock((p) => ({ ...p, stock: "out_of_stock" }));
    expect(isOrderable(sold, "rdp-pro", "united-states")).toBe(false);
    expect(locationAvailable(sold, "rdp", "united-states")).toBe(false);
  });

  it("still allows low stock", () => {
    const low = withStock((p) => ({ ...p, stock: "low" }));
    expect(isOrderable(low, "rdp-pro", "united-states")).toBe(true);
  });
});

describe("orderPath", () => {
  it("round-trips through the URL", () => {
    expect(orderPath({ product: "vps", locationSlug: "united-states", planSlug: "xl" })).toBe(
      "/order/new?product=vps&country=united-states&plan=xl",
    );
  });
});

describe("planAvailability and whyPlanUnavailable", () => {
  it("says why a plan can't be ordered in a country", () => {
    const sold = withStock((p) => (p.planId === "rdp-pro" && p.locationId === "india" ? { ...p, stock: "out_of_stock" } : p));
    expect(planAvailability(sold, "rdp-pro", "india")).toEqual({ ok: false, reason: "sold_out" });
    expect(planAvailability({ ...seed, pricing: [] }, "rdp-pro", "india")).toEqual({ ok: false, reason: "not_offered" });
    expect(planAvailability(seed, "rdp-pro", "india")).toEqual({ ok: true, stock: "in_stock" });
    expect(whyPlanUnavailable("RDP Pro", "India", { ok: false, reason: "sold_out" })).toBe(
      "RDP Pro is out of stock in India right now. Choose another plan, or another country.",
    );
    expect(whyPlanUnavailable("RDP Pro", "India", { ok: false, reason: "not_offered" })).toContain("isn't offered in India");
  });
});

describe("countryStatus", () => {
  it("summarises what a country can sell for a product", () => {
    expect(countryStatus(seed, "rdp", "india")).toMatchObject({ state: "available", orderable: 4, from: 600 });
    expect(countryStatus({ ...seed, pricing: [] }, "vps", "india")).toEqual({ state: "not_offered", orderable: 0, from: null });
    const sold = withStock((p) => ({ ...p, stock: "out_of_stock" }));
    expect(countryStatus(sold, "rdp", "india")).toEqual({ state: "sold_out", orderable: 0, from: null });
    const low = withStock((p) => ({ ...p, stock: "low" }));
    expect(countryStatus(low, "rdp", "india").state).toBe("low");
  });
});

describe("resolveSelection with a preferred country", () => {
  it("uses the signed-in customer's billing country only when the URL names none", () => {
    expect(resolveSelection(seed, { prefer: "in" })?.locationSlug).toBe("india");
    expect(resolveSelection(seed, { country: "united-kingdom", prefer: "IN" })?.locationSlug).toBe("united-kingdom");
    // a country we don't sell in (we do not host in Pakistan) is ignored
    expect(resolveSelection(seed, { prefer: "PK" })?.locationSlug).toBe("united-states");
  });
});

describe("effectiveStep and the step in the address", () => {
  it("never shows review to a visitor who isn't signed in, or account to one who is", () => {
    expect(effectiveStep("review", false, false)).toBe("account");
    expect(effectiveStep("account", true, false)).toBe("review");
    expect(effectiveStep(null, false, false)).toBe("plan");
    expect(effectiveStep("nonsense", true, false)).toBe("plan");
    expect(effectiveStep("plan", true, false)).toBe("plan");
  });

  it("a renewal skips configuring", () => {
    expect(effectiveStep(null, true, true)).toBe("review");
    expect(effectiveStep(null, false, true)).toBe("account");
  });

  it("someone who arrives with a plan and a country chosen skips straight past configuring", () => {
    expect(effectiveStep(null, false, false, true)).toBe("account");
    expect(effectiveStep(null, true, false, true)).toBe("review");
    // …unless they asked for the plan step (Change)
    expect(effectiveStep("plan", true, false, true)).toBe("plan");
    // a plan alone (from the pricing cards) still starts at the plan, so the country gets chosen
    expect(effectiveStep(null, true, false, false)).toBe("plan");
  });

  it("puts the step in the address only when asked", () => {
    const sel = { product: "rdp" as const, locationSlug: "india", planSlug: "standard" };
    expect(orderPath(sel)).toBe("/order/new?product=rdp&country=india&plan=standard");
    expect(orderPath(sel, "plan")).toBe("/order/new?product=rdp&country=india&plan=standard&step=plan");
    expect(orderPath(sel, "review")).toBe("/order/new?product=rdp&country=india&plan=standard&step=review");
  });
});
