// Generates src/content/world.ts — every country we can sell in, with its real English name, region and map position.
//   node scripts/gen-world.mjs
// Names come from the runtime's own Intl data (so nothing is hand-typed), tidied for a few well-known awkward ones, and are
// written into the file as plain strings so server and browser always agree (no hydration mismatch from differing ICU data).
import { writeFileSync } from "node:fs";

// iso2: [region, lat, lng]. Positions are country centres (the map marks the country, not a data centre).
const T = {
  // Asia
  AF: ["Asia", 33.9, 67.7], BD: ["Asia", 23.7, 90.4], BT: ["Asia", 27.5, 90.4], IN: ["Asia", 21.0, 78.0], LK: ["Asia", 7.9, 80.8],
  MV: ["Asia", 3.2, 73.2], NP: ["Asia", 28.4, 84.1], PK: ["Asia", 30.4, 69.3],
  KZ: ["Asia", 48.0, 67.0], KG: ["Asia", 41.2, 74.8], TJ: ["Asia", 38.9, 71.3], TM: ["Asia", 39.0, 59.6], UZ: ["Asia", 41.4, 64.6],
  CN: ["Asia", 35.0, 103.0], HK: ["Asia", 22.3, 114.2], JP: ["Asia", 36.2, 138.3], KP: ["Asia", 40.3, 127.5], KR: ["Asia", 36.5, 127.9],
  MN: ["Asia", 46.9, 103.8], MO: ["Asia", 22.2, 113.5], TW: ["Asia", 23.7, 121.0],
  BN: ["Asia", 4.5, 114.7], ID: ["Asia", -2.5, 118.0], KH: ["Asia", 12.6, 104.9], LA: ["Asia", 19.9, 102.5], MM: ["Asia", 21.9, 95.9],
  MY: ["Asia", 4.2, 102.0], PH: ["Asia", 12.9, 121.8], SG: ["Asia", 1.35, 103.8], TH: ["Asia", 15.9, 101.0], TL: ["Asia", -8.9, 125.7],
  VN: ["Asia", 14.1, 108.3], AM: ["Asia", 40.1, 45.0], AZ: ["Asia", 40.1, 47.6], GE: ["Asia", 42.3, 43.4],
  // Middle East
  AE: ["Middle East", 23.4, 53.8], BH: ["Middle East", 26.0, 50.55], IL: ["Middle East", 31.0, 34.9], IQ: ["Middle East", 33.2, 43.7],
  IR: ["Middle East", 32.4, 53.7], JO: ["Middle East", 31.0, 36.5], KW: ["Middle East", 29.3, 47.5], LB: ["Middle East", 33.9, 35.9],
  OM: ["Middle East", 21.5, 55.9], PS: ["Middle East", 31.95, 35.2], QA: ["Middle East", 25.35, 51.2], SA: ["Middle East", 23.9, 45.1],
  SY: ["Middle East", 34.8, 39.0], TR: ["Middle East", 39.0, 35.2], YE: ["Middle East", 15.6, 48.5],
  // Europe
  AL: ["Europe", 41.15, 20.2], AD: ["Europe", 42.5, 1.6], AT: ["Europe", 47.5, 14.55], BY: ["Europe", 53.7, 27.95], BE: ["Europe", 50.5, 4.5],
  BA: ["Europe", 43.9, 17.7], BG: ["Europe", 42.7, 25.5], HR: ["Europe", 45.1, 15.2], CY: ["Europe", 35.1, 33.4], CZ: ["Europe", 49.8, 15.5],
  DK: ["Europe", 56.3, 9.5], EE: ["Europe", 58.6, 25.0], FI: ["Europe", 61.9, 25.7], FR: ["Europe", 46.2, 2.2], DE: ["Europe", 51.2, 10.45],
  GR: ["Europe", 39.07, 21.8], HU: ["Europe", 47.2, 19.5], IS: ["Europe", 64.96, -19.0], IE: ["Europe", 53.4, -8.2], IT: ["Europe", 41.9, 12.6],
  XK: ["Europe", 42.6, 20.9], LV: ["Europe", 56.9, 24.6], LI: ["Europe", 47.15, 9.55], LT: ["Europe", 55.2, 23.9], LU: ["Europe", 49.8, 6.1],
  MT: ["Europe", 35.9, 14.4], MD: ["Europe", 47.4, 28.4], MC: ["Europe", 43.75, 7.4], ME: ["Europe", 42.7, 19.4], NL: ["Europe", 52.1, 5.3],
  MK: ["Europe", 41.6, 21.7], NO: ["Europe", 60.5, 8.5], PL: ["Europe", 51.9, 19.1], PT: ["Europe", 39.4, -8.2], RO: ["Europe", 45.9, 24.97],
  RU: ["Europe", 61.5, 105.3], SM: ["Europe", 43.9, 12.46], RS: ["Europe", 44.0, 21.0], SK: ["Europe", 48.7, 19.7], SI: ["Europe", 46.15, 14.99],
  ES: ["Europe", 40.5, -3.7], SE: ["Europe", 60.1, 18.6], CH: ["Europe", 46.8, 8.2], UA: ["Europe", 48.4, 31.2], GB: ["Europe", 54.0, -2.5],
  VA: ["Europe", 41.9, 12.45],
  // Africa
  DZ: ["Africa", 28.0, 1.7], AO: ["Africa", -11.2, 17.9], BJ: ["Africa", 9.3, 2.3], BW: ["Africa", -22.3, 24.7], BF: ["Africa", 12.2, -1.6],
  BI: ["Africa", -3.4, 29.9], CV: ["Africa", 16.0, -24.0], CM: ["Africa", 7.4, 12.35], CF: ["Africa", 6.6, 20.9], TD: ["Africa", 15.5, 18.7],
  KM: ["Africa", -11.9, 43.9], CG: ["Africa", -0.2, 15.8], CD: ["Africa", -4.0, 21.8], CI: ["Africa", 7.5, -5.5], DJ: ["Africa", 11.8, 42.6],
  EG: ["Africa", 26.8, 30.8], GQ: ["Africa", 1.65, 10.3], ER: ["Africa", 15.2, 39.8], SZ: ["Africa", -26.5, 31.5], ET: ["Africa", 9.1, 40.5],
  GA: ["Africa", -0.8, 11.6], GM: ["Africa", 13.4, -15.3], GH: ["Africa", 7.95, -1.0], GN: ["Africa", 9.9, -9.7], GW: ["Africa", 11.8, -15.2],
  KE: ["Africa", 0.0, 37.9], LS: ["Africa", -29.6, 28.2], LR: ["Africa", 6.4, -9.4], LY: ["Africa", 26.3, 17.2], MG: ["Africa", -18.8, 46.9],
  MW: ["Africa", -13.25, 34.3], ML: ["Africa", 17.6, -4.0], MR: ["Africa", 21.0, -10.9], MU: ["Africa", -20.3, 57.55], MA: ["Africa", 31.8, -7.1],
  MZ: ["Africa", -18.7, 35.5], NA: ["Africa", -22.96, 18.5], NE: ["Africa", 17.6, 8.1], NG: ["Africa", 9.1, 8.7], RW: ["Africa", -1.9, 29.9],
  ST: ["Africa", 0.2, 6.6], SN: ["Africa", 14.5, -14.45], SC: ["Africa", -4.7, 55.5], SL: ["Africa", 8.5, -11.8], SO: ["Africa", 5.15, 46.2],
  ZA: ["Africa", -30.6, 22.9], SS: ["Africa", 6.9, 31.3], SD: ["Africa", 12.9, 30.2], TZ: ["Africa", -6.4, 34.9], TG: ["Africa", 8.6, 0.8],
  TN: ["Africa", 33.9, 9.5], UG: ["Africa", 1.4, 32.3], ZM: ["Africa", -13.1, 27.85], ZW: ["Africa", -19.0, 29.15],
  // North America (with Central America and the Caribbean)
  US: ["North America", 39.8, -98.6], CA: ["North America", 56.1, -106.3], MX: ["North America", 23.6, -102.5], BZ: ["North America", 17.2, -88.5],
  CR: ["North America", 9.75, -83.75], SV: ["North America", 13.8, -88.9], GT: ["North America", 15.8, -90.2], HN: ["North America", 15.2, -86.2],
  NI: ["North America", 12.9, -85.2], PA: ["North America", 8.5, -80.8], AG: ["North America", 17.1, -61.8], BS: ["North America", 25.0, -77.4],
  BB: ["North America", 13.2, -59.5], CU: ["North America", 21.5, -77.8], DM: ["North America", 15.4, -61.4], DO: ["North America", 18.7, -70.2],
  GD: ["North America", 12.1, -61.7], HT: ["North America", 18.97, -72.3], JM: ["North America", 18.1, -77.3], KN: ["North America", 17.3, -62.7],
  LC: ["North America", 13.9, -61.0], VC: ["North America", 13.25, -61.2], TT: ["North America", 10.7, -61.2], PR: ["North America", 18.2, -66.5],
  // South America
  AR: ["South America", -38.4, -63.6], BO: ["South America", -16.3, -63.6], BR: ["South America", -14.2, -51.9], CL: ["South America", -35.7, -71.5],
  CO: ["South America", 4.6, -74.3], EC: ["South America", -1.8, -78.2], GY: ["South America", 4.9, -58.9], PY: ["South America", -23.4, -58.4],
  PE: ["South America", -9.2, -75.0], SR: ["South America", 3.9, -56.0], UY: ["South America", -32.5, -55.8], VE: ["South America", 6.4, -66.6],
  // Oceania
  AU: ["Oceania", -25.3, 133.8], FJ: ["Oceania", -17.7, 178.1], KI: ["Oceania", 1.9, -157.4], MH: ["Oceania", 7.1, 171.2], FM: ["Oceania", 6.9, 158.2],
  NR: ["Oceania", -0.5, 166.9], NZ: ["Oceania", -40.9, 174.9], PW: ["Oceania", 7.5, 134.6], PG: ["Oceania", -6.3, 143.95], WS: ["Oceania", -13.76, -172.1],
  SB: ["Oceania", -9.6, 160.2], TO: ["Oceania", -21.2, -175.2], TV: ["Oceania", -7.5, 178.7], VU: ["Oceania", -15.4, 166.96],
};

// Intl's English names, tidied for the ones people actually search for.
const OVERRIDE = {
  AG: "Antigua and Barbuda", BA: "Bosnia and Herzegovina", CD: "DR Congo", CG: "Congo", CI: "Ivory Coast", HK: "Hong Kong", KN: "Saint Kitts and Nevis",
  LC: "Saint Lucia", MM: "Myanmar", MO: "Macau", PS: "Palestine", ST: "São Tomé and Príncipe", TR: "Turkey", TT: "Trinidad and Tobago",
  VC: "Saint Vincent and the Grenadines", XK: "Kosovo", GB: "United Kingdom", US: "United States",
};

const names = new Intl.DisplayNames(["en"], { type: "region" });
const rows = Object.entries(T)
  .map(([iso2, [region, lat, lng]]) => ({ iso2, name: OVERRIDE[iso2] ?? names.of(iso2), region, lat, lng }))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

const missing = rows.filter((r) => !r.name || r.name === r.iso2);
if (missing.length) throw new Error("No name for: " + missing.map((m) => m.iso2).join(", "));

const q = (s) => JSON.stringify(s);
const out = `/**
 * Every country we can sell in: real English name, region and a map position (country centre).
 * GENERATED by scripts/gen-world.mjs — edit the script, not this file.
 *
 * Which of these are actually on sale is decided in Admin → Catalog → Countries (the \`locations\` and
 * \`plan_pricing\` tables). This list is only the menu the admin picks from, and the source of names, regions and flags.
 */
export type Region = "Asia" | "Middle East" | "Europe" | "Africa" | "North America" | "South America" | "Oceania";

export interface WorldCountry {
  /** ISO 3166-1 alpha-2, upper case — also the name of its flag image (public/flags/w64/<code>.png). */
  iso2: string;
  name: string;
  region: Region;
  lat: number;
  lng: number;
}

export const REGIONS: readonly Region[] = ["Asia", "Middle East", "Europe", "Africa", "North America", "South America", "Oceania"];

export const WORLD: readonly WorldCountry[] = [
${rows.map((r) => `  { iso2: ${q(r.iso2)}, name: ${q(r.name)}, region: ${q(r.region)}, lat: ${r.lat}, lng: ${r.lng} },`).join("\n")}
];

const BY_ISO = new Map(WORLD.map((c) => [c.iso2, c]));

export const worldCountry = (iso2: string | null | undefined) => (iso2 ? BY_ISO.get(iso2.trim().toUpperCase()) : undefined);
/** Has a flag image and a name in our list. */
export const knownCountry = (iso2: string) => BY_ISO.has(iso2.trim().toUpperCase());
`;
writeFileSync(new URL("../src/content/world.ts", import.meta.url), out);
console.log(`wrote src/content/world.ts — ${rows.length} countries`);
