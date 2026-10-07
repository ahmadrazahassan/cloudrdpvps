import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { locations, paymentMethods, plans, pricing } from "@/content/catalog";
import launch from "@/content/launch.json";
import { worldCountry } from "@/content/world";
import { directoryItems, placesPhrase, type Catalog } from "./catalog";
import { countryStatus, resolveSelection } from "./checkout";

const catalog: Catalog = { locations, plans, pricing, paymentMethods };

describe("placesPhrase", () => {
  const names = (...n: string[]) => n.map((name) => ({ name }));
  it("names a handful, counts many", () => {
    expect(placesPhrase(names("Germany"))).toBe("Germany");
    expect(placesPhrase(names("Germany", "India", "Japan"))).toBe("Germany, India and Japan");
    expect(placesPhrase(names(..."abcdefg".split("")))).toBe("7 countries");
    expect(placesPhrase([])).toBe("countries around the world");
  });
});

describe("the launch catalog (what the site shows before the owner changes anything)", () => {
  it("covers more than 70 real countries, and Pakistan is not one of them", () => {
    expect(locations.length).toBeGreaterThan(70);
    expect(locations.some((l) => l.iso2 === "PK")).toBe(false);
    expect(locations.some((l) => /pakistan/i.test(l.name) || l.slug === "pakistan")).toBe(false);
  });

  it("uses each country's real name, a unique address and a real flag file", () => {
    expect(new Set(locations.map((l) => l.iso2)).size).toBe(locations.length);
    expect(new Set(locations.map((l) => l.slug)).size).toBe(locations.length);
    for (const l of locations) {
      expect(l.name, l.iso2).toBe(worldCountry(l.iso2)?.name);
      expect(l.slug).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(existsSync(path.join(process.cwd(), "public/flags/w64", `${l.iso2.toLowerCase()}.png`)), `flag for ${l.iso2}`).toBe(true);
    }
    expect(locations.find((l) => l.iso2 === "US")).toMatchObject({ name: "United States", slug: "united-states" });
    expect(locations.find((l) => l.iso2 === "GB")).toMatchObject({ name: "United Kingdom", slug: "united-kingdom" });
  });

  it("lists the most-asked-for countries first", () => {
    expect(locations.slice(0, 3).map((l) => l.iso2)).toEqual(["US", "GB", "DE"]);
    expect(locations.map((l) => l.sortOrder)).toEqual(locations.map((_, i) => i + 1));
  });

  it("prices every plan in every country, by tier", () => {
    expect(pricing).toHaveLength(locations.length * plans.length);
    const price = (slug: string, plan: string) => pricing.find((p) => p.locationId === slug && p.planId === plan)?.priceCents;
    expect(price("india", "rdp-standard")).toBe(1200); // value
    expect(price("united-states", "rdp-standard")).toBe(1600); // standard
    expect(price("united-kingdom", "rdp-standard")).toBe(1800); // premium
    expect(pricing.every((p) => p.stock === "in_stock" && p.priceCents > 0)).toBe(true);
  });

  it("is built only from known countries and plans", () => {
    for (const [iso2, tier] of launch.countries) {
      expect(worldCountry(iso2), iso2).toBeDefined();
      expect(Object.keys(launch.tiers)).toContain(tier);
    }
    expect(new Set(launch.countries.map(([c]) => c)).size).toBe(launch.countries.length);
    expect(launch.plans.map((p) => p.replace("/", "-"))).toEqual(plans.map((p) => p.id));
  });

  it("builds the directory with a region and starting prices for every country", () => {
    const items = directoryItems(catalog);
    expect(items).toHaveLength(locations.length);
    expect(items.find((i) => i.iso2 === "IN")).toMatchObject({ name: "India", region: "Asia", rdp: 600, vps: 800 });
    expect(items.find((i) => i.iso2 === "DE")).toMatchObject({ region: "Europe", rdp: 1000 });
    expect(items.every((i) => i.region !== "Other")).toBe(true);
  });

  it("sends a new visitor to the first country with everything in stock, on the featured plan", () => {
    expect(resolveSelection(catalog, {})).toEqual({ product: "rdp", locationSlug: "united-states", planSlug: "standard" });
    // a signed-in customer's own country, when we sell there
    expect(resolveSelection(catalog, { prefer: "IN" })?.locationSlug).toBe("india");
    // a country we don't sell in (Pakistan) is ignored
    expect(resolveSelection(catalog, { prefer: "PK" })?.locationSlug).toBe("united-states");
    expect(resolveSelection(catalog, { country: "pakistan" })?.locationSlug).toBe("united-states");
  });

  it("every country can sell both products", () => {
    for (const l of locations) {
      expect(countryStatus(catalog, "rdp", l.id).state, l.name).toBe("available");
      expect(countryStatus(catalog, "vps", l.id).state, l.name).toBe("available");
    }
  });
});
