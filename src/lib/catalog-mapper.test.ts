import { describe, expect, it } from "vitest";
import { mapCatalog, type CatalogRows } from "./catalog-mapper";

const loc = (over: Partial<CatalogRows["locations"][number]>): CatalogRows["locations"][number] => ({
  id: "l1",
  name: "India",
  slug: "india",
  iso2: "IN",
  image_key: null,
  blurb: null,
  sort_order: 1,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...over,
});

const rows = (locations: CatalogRows["locations"]): CatalogRows => ({ locations, plans: [], pricing: [], paymentMethods: [] });

describe("mapCatalog and countries", () => {
  it("accepts any country, not just the first five", () => {
    const { locations } = mapCatalog(rows([loc({}), loc({ id: "l2", name: "Germany", slug: "germany", iso2: "DE", sort_order: 2 }), loc({ id: "l3", name: "Japan", slug: "japan", iso2: "jp ", sort_order: 3 })]));
    expect(locations.map((l) => l.iso2)).toEqual(["IN", "DE", "JP"]);
  });

  it("keeps skyline artwork for the first five and none for the rest", () => {
    const { locations } = mapCatalog(rows([loc({}), loc({ id: "l2", name: "Germany", slug: "germany", iso2: "DE", sort_order: 2 })]));
    expect(locations[0]?.imageKey).toBe("loc-in");
    expect(locations[1]).not.toHaveProperty("imageKey");
  });

  it("shows the first launch's short names as real country names", () => {
    const { locations } = mapCatalog(rows([loc({ id: "u", name: "USA", slug: "usa", iso2: "US" }), loc({ id: "k", name: "UK", slug: "uk", iso2: "GB", sort_order: 2 })]));
    expect(locations.map((l) => l.name)).toEqual(["United States", "United Kingdom"]);
  });

  it("skips switched-off locations and malformed codes instead of failing", () => {
    const { locations } = mapCatalog(rows([loc({ is_active: false }), loc({ id: "x", iso2: "PAK", slug: "pak", name: "Pak" }), loc({ id: "y", iso2: "IN", slug: "india", name: "India", sort_order: 2 })]));
    expect(locations.map((l) => l.iso2)).toEqual(["IN"]);
  });
});
