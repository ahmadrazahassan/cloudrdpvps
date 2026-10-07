// Prepares the globe picture for the locations section:  public/global.png  →  public/images/locations/globe.webp
//   node scripts/build-globe.mjs
// The original is a wide picture of a glass globe on a little stand, on white. The section wants the globe alone, square, so it
// can spin on any background: this crops to the sphere, turns the white into transparency (so the glass stays glass — pale where
// it's clear, saturated where it's blue), trims the stand away with a soft circular edge, and saves a transparent WebP.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sharp = createRequire(path.join(root, "package.json"))("sharp");

// Measured on the 1672 × 941 original: the sphere is centred at (840, 457) and is 833 px across.
const CENTER = { x: 840, y: 457 };
const RADIUS = 416;
const PAD = 10; // room for the glass's soft edge
const SIZE = (RADIUS + PAD) * 2;
const OUT = 1100;

const { data, info } = await sharp(path.join(root, "public/global.png"))
  .extract({ left: CENTER.x - (RADIUS + PAD), top: CENTER.y - (RADIUS + PAD), width: SIZE, height: SIZE })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const c = SIZE / 2;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    // the picture as it looks on white
    const a0 = data[i + 3] / 255;
    const r = data[i] * a0 + 255 * (1 - a0);
    const g = data[i + 1] * a0 + 255 * (1 - a0);
    const b = data[i + 2] * a0 + 255 * (1 - a0);
    // white → transparent: the least-white channel says how much of the picture is really there
    const alpha = 255 - Math.min(r, g, b);
    const k = alpha / 255;
    // …and a soft circular edge, which also removes the stand
    const d = Math.hypot(x - c + 0.5, y - c + 0.5);
    // the bottom edge is drawn a little tighter, which takes off the last of the stand
    const reach = RADIUS - 14 * smooth(0.6 * RADIUS, RADIUS, y - c);
    const edge = 1 - smooth(reach - 3, reach + 4, d);
    const outAlpha = Math.round(alpha * edge);
    if (outAlpha < 2) {
      data[i + 3] = 0;
      continue;
    }
    data[i] = Math.min(255, Math.max(0, Math.round((r - (255 - alpha)) / k)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round((g - (255 - alpha)) / k)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round((b - (255 - alpha)) / k)));
    data[i + 3] = outAlpha;
  }
}

mkdirSync(path.join(root, "public/images/locations"), { recursive: true });
const file = path.join(root, "public/images/locations/globe.webp");
const out = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .resize(OUT, OUT)
  .webp({ quality: 92, alphaQuality: 100 })
  .toFile(file);
console.log(`wrote public/images/locations/globe.webp (${OUT}×${OUT}, ${Math.round(out.size / 1024)} KB)`);
