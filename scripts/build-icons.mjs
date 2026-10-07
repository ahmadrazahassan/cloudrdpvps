// All brand assets use the same geometry as the React logo and social preview.
// Run `npm run icons:build` after editing src/content/brand.json.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import brand from "../src/content/brand.json" with { type: "json" };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sharp = createRequire(path.join(root, "package.json"))("sharp");
const brandDir = path.join(root, "public/brand");
const iconDir = path.join(root, "public/icons");
mkdirSync(brandDir, { recursive: true });
mkdirSync(iconDir, { recursive: true });

const drawPaths = (items, color, accent = color) => items.map((p) => `<path d="${p.d}" transform="${p.transform}" fill="${p.role === "accent" ? accent : color}"/>`).join("");
const paths = (color, accent = color) => drawPaths(brand.paths, color, accent);
const svg = (color, accent) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${brand.viewBox}" width="512" height="512" role="img" aria-label="${brand.name}">${paths(color, accent)}</svg>\n`;
const savePng = async (source, size, file) => {
  await sharp(Buffer.from(source), { density: 192 }).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(root, file));
};

// Transparent, reusable marks. No background rectangle, including the white version.
for (const [name, color, accent] of [
  ["logo-mark", brand.ink, brand.primary],
  ["logo-mark-light", brand.light, brand.lightAccent],
  ["logo-mark-black", brand.ink, brand.ink],
  ["logo-mark-white", brand.light, brand.light],
]) {
  const source = svg(color, accent);
  writeFileSync(path.join(brandDir, `${name}.svg`), source);
  await savePng(source, 1024, `public/brand/${name}.png`);
}

// The complete regular-weight wordmark is outlined: no runtime or installed fonts.
const lockups = new Map();
for (const [name, color, accent] of [
  ["logo", brand.ink, brand.primary],
  ["logo-light", brand.light, brand.lightAccent],
  ["logo-black", brand.ink, brand.ink],
  ["logo-white", brand.light, brand.light],
]) {
  const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${brand.lockupViewBox}" width="${brand.lockupWidth}" height="${brand.lockupHeight}" role="img" aria-label="${brand.name}">${drawPaths(brand.lockupPaths, color, accent)}</svg>\n`;
  writeFileSync(path.join(brandDir, `${name}.svg`), source);
  lockups.set(name, source);
  await sharp(Buffer.from(source), { density: 144 }).resize({ width: 2400 }).png({ compressionLevel: 9 }).toFile(path.join(brandDir, `${name}.png`));
}

// A compact preview of the actual transparent production assets on both site surfaces.
const previewDir = path.join(root, "output/branding");
mkdirSync(previewDir, { recursive: true });
const previewBackground = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="360"><rect width="1000" height="360" fill="#F1F1F1"/><rect x="500" width="500" height="360" fill="${brand.ink}"/></svg>`;
const previewLayers = await Promise.all(["logo", "logo-light"].map(async (name, i) => ({
  input: await sharp(Buffer.from(lockups.get(name)), { density: 144 }).resize({ width: 420 }).png().toBuffer(),
  left: i * 500 + 40,
  top: 150,
})));
await sharp(Buffer.from(previewBackground)).composite(previewLayers).png().toFile(path.join(previewDir, "brand-preview.png"));

// SVG browser favicon follows the tab's color scheme and stays transparent.
writeFileSync(path.join(root, "src/app/icon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${brand.viewBox}" width="64" height="64">
  <style>:root{--mark:${brand.ink};--accent:${brand.accent}}@media(prefers-color-scheme:dark){:root{--mark:${brand.light};--accent:${brand.lightAccent}}}</style>
  ${paths("var(--mark)", "var(--accent)")}
</svg>\n`);

// Solid backgrounds keep legacy favicons and home-screen icons visible on any surface.
// Maskable icons reserve the central 60%, safely within circular / squircle masks.
const appSvg = (fraction = 0.82) => {
  const inset = (64 - 64 * fraction) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512"><rect width="64" height="64" fill="${brand.ink}"/><g transform="translate(${inset} ${inset}) scale(${fraction})">${paths(brand.light, brand.lightAccent)}</g></svg>`;
};
await savePng(appSvg(), 192, "public/icons/icon-192.png");
await savePng(appSvg(), 512, "public/icons/icon-512.png");
await savePng(appSvg(0.6), 512, "public/icons/icon-maskable-512.png");
await savePng(appSvg(0.7), 180, "src/app/apple-icon.png");

const sizes = [16, 32, 48, 64];
const images = await Promise.all(sizes.map((size) => sharp(Buffer.from(appSvg()), { density: 192 }).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = 6 + 16 * images.length;
const entries = images.map((img, i) => {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(sizes[i], 0);
  entry.writeUInt8(sizes[i], 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(img.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += img.length;
  return entry;
});
writeFileSync(path.join(root, "src/app/favicon.ico"), Buffer.concat([header, ...entries, ...images]));
console.log("Built transparent brand marks, adaptive SVG favicon, 16/32/48/64px favicon.ico, Apple and app icons.");
