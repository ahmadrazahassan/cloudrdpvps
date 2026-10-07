import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REGIONS, WORLD, knownCountry, worldCountry } from "./world";

describe("the world country list", () => {
  it("has the ~200 countries the owner can switch on, with unique codes and names", () => {
    expect(WORLD.length).toBeGreaterThanOrEqual(190);
    expect(new Set(WORLD.map((c) => c.iso2)).size).toBe(WORLD.length);
    expect(new Set(WORLD.map((c) => c.name)).size).toBe(WORLD.length);
  });

  it("uses real, readable country names", () => {
    expect(worldCountry("US")?.name).toBe("United States");
    expect(worldCountry("gb")?.name).toBe("United Kingdom");
    expect(worldCountry("AE")?.name).toBe("United Arab Emirates");
    expect(worldCountry("PK")?.name).toBe("Pakistan");
    expect(worldCountry("KR")?.name).toBe("South Korea");
    expect(WORLD.every((c) => c.name.length > 2 && c.name !== c.iso2)).toBe(true);
  });

  it("puts every country in a known region, with a position on the map", () => {
    for (const c of WORLD) {
      expect(REGIONS).toContain(c.region);
      expect(c.lat).toBeGreaterThanOrEqual(-90);
      expect(c.lat).toBeLessThanOrEqual(90);
      expect(c.lng).toBeGreaterThanOrEqual(-180);
      expect(c.lng).toBeLessThanOrEqual(180);
    }
  });

  it("has a real flag image file (1x and 2x) for every country", () => {
    const missing = WORLD.flatMap((c) => ["w64", "w128"].map((w) => `${w}/${c.iso2.toLowerCase()}.png`)).filter((f) => !existsSync(path.join(process.cwd(), "public/flags", f)));
    expect(missing).toEqual([]);
  });

  it("knows which codes it can draw", () => {
    expect(knownCountry("PK")).toBe(true);
    expect(knownCountry("pk")).toBe(true);
    expect(knownCountry("ZZ")).toBe(false);
  });
});
