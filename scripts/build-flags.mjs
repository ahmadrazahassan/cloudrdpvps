// Builds the flag images the site serves: public/flags/w64/<iso2>.png and public/flags/w128/<iso2>.png (3:2, for 1x / 2x screens).
//   node scripts/build-flags.mjs
// They are real national flags rasterised once from the open-source `country-flag-icons` artwork, so the site ships plain
// image files (cached by the browser, no inline SVG on the page) and needs nothing from a third-party host at runtime.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const sharp = require("sharp");

const world = readFileSync(path.join(root, "src/content/world.ts"), "utf8");
const codes = [...world.matchAll(/iso2: "([A-Z]{2})"/g)].map((m) => m[1]);
const sizes = [64, 128];
for (const w of sizes) mkdirSync(path.join(root, "public/flags", `w${w}`), { recursive: true });

let made = 0;
const missing = [];
for (const code of codes) {
  const svg = path.join(root, "node_modules/country-flag-icons/3x2", `${code}.svg`);
  if (!existsSync(svg)) {
    missing.push(code);
    continue;
  }
  const input = readFileSync(svg);
  for (const w of sizes) {
    const png = await sharp(input, { density: 600 }).resize({ width: w, height: Math.round((w * 2) / 3), fit: "fill" }).png({ compressionLevel: 9, palette: false }).toBuffer();
    writeFileSync(path.join(root, "public/flags", `w${w}`, `${code.toLowerCase()}.png`), png);
    made++;
  }
}
console.log(`wrote ${made} images for ${codes.length - missing.length} flags`);
if (missing.length) console.log("no artwork for:", missing.join(", "));
