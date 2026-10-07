// Turns the payment brands' official logo files into the small, transparent, square marks the site shows next to a
// method's name (checkout, homepage, invoices, admin).
//
//   node scripts/build-payment-logos.mjs      (or: npm run payments:build)
//
//   in   scripts/payment-logos-src/<brand>.png   the official files as supplied (any size, white or transparent background)
//   out  public/payments/<brand>.png             192 px square, transparent, the symbol only
//
// "Symbol only": JazzCash and Easypaisa come as a symbol stacked over their wordmark; the method's name is always written
// next to the logo, so only the symbol is kept. Meezan's roundel is already a symbol. Binance (public/payments/binance.svg)
// is hand-drawn vector and isn't built here.
//
// What it does, per file: a white background becomes transparency (colour-to-alpha, so anti-aliased edges stay clean),
// the symbol is cropped out, centred on a square canvas with a little air around it, and resized.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sharp = createRequire(path.join(root, "package.json"))("sharp");

const SIZE = 192; // output px (shown at ~28 CSS px, so sharp on 6x screens)
const MARGIN = 0.07; // air around the symbol, as a share of the canvas

const BRANDS = [
  { name: "jazzcash", keep: "top-block" },
  { name: "easypaisa", keep: "top-block", whiteToAlpha: true },
  { name: "meezan", keep: "all" },
];

/** Flatten any white background to transparency without fringing the edges. */
function whiteToAlpha(rgba) {
  const out = Buffer.from(rgba);
  for (let i = 0; i < out.length; i += 4) {
    const a0 = out[i + 3] / 255;
    // how far from white each channel is, scaled by the pixel's own opacity
    const d = [255 - out[i], 255 - out[i + 1], 255 - out[i + 2]].map((v) => v * a0);
    const a = Math.max(...d) / 255; // the least opacity that still explains the colour
    if (a < 0.03) {
      out[i + 3] = 0; // a ghost of near-white: drop it
      continue;
    }
    for (let c = 0; c < 3; c++) out[i + c] = Math.max(0, Math.min(255, Math.round(255 - d[c] / a)));
    out[i + 3] = Math.round(a * 255);
  }
  return out;
}

/** Rows (or columns) that hold any visible pixel, as [start, end] runs separated by at least `gap` empty lines. */
function runs(occupied, gap) {
  const found = [];
  let start = -1;
  let empty = 0;
  occupied.forEach((on, i) => {
    if (on) {
      if (start < 0) start = i;
      empty = 0;
    } else if (start >= 0 && ++empty >= gap) {
      found.push([start, i - empty]);
      start = -1;
    }
  });
  if (start >= 0) found.push([start, occupied.length - 1 - empty]);
  return found;
}

async function build({ name, keep, whiteToAlpha: flatten }) {
  const file = path.join(root, "scripts", "payment-logos-src", `${name}.png`);
  const { data, info } = await sharp(readFileSync(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const rgba = flatten ? whiteToAlpha(data) : data;

  const visible = (x, y) => rgba[(y * width + x) * 4 + 3] > 40;
  const rowOn = Array.from({ length: height }, (_, y) => {
    for (let x = 0; x < width; x++) if (visible(x, y)) return true;
    return false;
  });
  const lines = runs(rowOn, Math.max(4, Math.round(height * 0.025)));
  if (lines.length === 0) throw new Error(`${name}: nothing visible in the image`);
  const [top, bottom] = keep === "top-block" ? lines[0] : [lines[0][0], lines[lines.length - 1][1]];

  const colOn = Array.from({ length: width }, (_, x) => {
    for (let y = top; y <= bottom; y++) if (visible(x, y)) return true;
    return false;
  });
  const cols = runs(colOn, width); // one run: first to last visible column
  const [left, right] = [cols[0][0], cols[cols.length - 1][1]];

  const cropW = right - left + 1;
  const cropH = bottom - top + 1;
  const side = Math.max(cropW, cropH);
  const inner = Math.round(SIZE * (1 - 2 * MARGIN));

  const symbol = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: cropW, height: cropH })
    .resize({ width: Math.round((cropW / side) * inner), height: Math.round((cropH / side) * inner), kernel: "lanczos3" })
    .png()
    .toBuffer();

  const out = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: symbol, gravity: "centre" }])
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();

  mkdirSync(path.join(root, "public", "payments"), { recursive: true });
  writeFileSync(path.join(root, "public", "payments", `${name}.png`), out);
  console.log(`${name.padEnd(10)} ${width}x${height} → symbol ${cropW}x${cropH} → ${SIZE}x${SIZE}  ${(out.length / 1024).toFixed(1)} KB`);
}

for (const brand of BRANDS) await build(brand);
