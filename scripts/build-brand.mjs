// Build the simple C / connection-point identity and its regular-weight wordmark.
// All letters are outlined so the complete logo needs no runtime fonts.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bytes = readFileSync(path.join(root, "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff"));
const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const name = "Cloud RDP VPS";
const fontSize = 38;
const scale = fontSize / font.unitsPerEm;
const glyphs = Array.from(name, (letter) => font.charToGlyph(letter));
let cursor = 68;
const wordmark = [];

// The exact English brand name needs only ordinary glyphs and pair kerning.
for (const [index, glyph] of glyphs.entries()) {
  if (index) cursor += font.getKerningValue(glyphs[index - 1], glyph) * scale;
  const outline = glyph.getPath(cursor, 46, fontSize).toPathData(3);
  if (outline) wordmark.push({ d: outline, transform: "", role: "wordmark" });
  cursor += glyph.advanceWidth * scale;
}

const paths = [
  {
    d: "M47 8H31C17.745 8 7 18.745 7 32S17.745 56 31 56H47C48.657 56 50 54.657 50 53V49C50 47.343 48.657 46 47 46H31C23.268 46 17 39.732 17 32S23.268 18 31 18H47C48.657 18 50 16.657 50 15V11C50 9.343 48.657 8 47 8Z",
    transform: "",
    role: "mark",
  },
  {
    d: "M53 26H57C58.657 26 60 27.343 60 29V35C60 36.657 58.657 38 57 38H53C51.343 38 50 36.657 50 35V29C50 27.343 51.343 26 53 26Z",
    transform: "",
    role: "accent",
  },
];
const width = Math.ceil(cursor + 3);
const brand = {
  name,
  concept: "Connection C: an open charcoal C and a lavender connection point, with a single-line regular-weight wordmark.",
  ink: "#17171C",
  accent: "#8B5FD3",
  primary: "#9468E0",
  light: "#FFFFFF",
  lightAccent: "#C6AEF3",
  viewBox: "0 0 64 64",
  lockupViewBox: `0 0 ${width} 64`,
  lockupWidth: width,
  lockupHeight: 64,
  paths,
  lockupPaths: [
    ...paths.map((item) => ({ ...item, transform: "translate(0 4.8) scale(0.85)" })),
    ...wordmark,
  ],
};
writeFileSync(path.join(root, "src/content/brand.json"), JSON.stringify(brand, null, 2) + "\n");
console.log(`Built ${width} × 64 complete vector logo with regular Inter 400 lettering.`);
