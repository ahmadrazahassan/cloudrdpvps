import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The site uses exactly two typefaces: Inter Tight (display) and Inter (everything else).
 * These checks fail the build if a third one — or a way to get one — sneaks back in.
 */
const root = path.resolve(__dirname, "..", "..");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const sourceFiles = walk(path.join(root, "src")).filter(
  (f) => /\.(tsx?|css)$/.test(f) && !f.endsWith("typography.test.ts") && !f.includes(`${path.sep}types${path.sep}`),
);
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("typography: Inter Tight + Inter only", () => {
  it("loads exactly those two families from next/font", () => {
    const layout = read("src/app/layout.tsx");
    const imports = layout.match(/import \{([^}]+)\} from "next\/font\/google"/)?.[1].split(",").map((s) => s.trim()).sort();
    expect(imports).toEqual(["Inter", "Inter_Tight"]);
  });

  it("references no other typeface, token or utility anywhere in src/", () => {
    const forbidden = [
      /Source[_ ]Serif/i,
      /IBM[_ ]Plex/i,
      /plex[-_ ]?mono/i,
      /--font-source-serif/,
      /--font-plex-mono/,
      /--font-serif/,
      /--font-mono/,
      /\bfont-serif\b/,
      /\bfont-mono\b/,
      /label-mono/,
      /ui-monospace|SFMono|Menlo|Consolas|Courier/i,
      /\bGeorgia\b|\bTimes\b/,
    ];
    const hits: string[] = [];
    for (const file of sourceFiles) {
      // the list of countries has Georgia in it — the country, not the typeface
      if (/content[\\/]world\.(test\.)?ts$/.test(file)) continue;
      const text = readFileSync(file, "utf8");
      for (const re of forbidden) {
        // mentions inside comments that explain the rule are fine only in globals.css's own header
        if (re.test(text)) hits.push(`${path.relative(root, file)}: ${re}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("defines only the two font tokens, and clears Tailwind's built-in stacks", () => {
    const css = read("src/app/globals.css");
    expect(css).toMatch(/--font-\*:\s*initial;/);
    expect(css).toMatch(/--font-sans:\s*var\(--font-inter\)/);
    expect(css).toMatch(/--font-display:\s*var\(--font-inter-tight\)/);
    const tokens = [...css.matchAll(/--font-([a-z-]+):/g)].map((m) => m[1]).filter((n) => !n.startsWith("inter"));
    expect(new Set(tokens)).toEqual(new Set(["sans", "display"]));
  });

  it("has no font files or @font-face rules of its own", () => {
    expect(sourceFiles.filter((f) => /@font-face/.test(readFileSync(f, "utf8")))).toEqual([]);
    const pub = walk(path.join(root, "public")).filter((f) => /\.(woff2?|ttf|otf|eot)$/i.test(f));
    expect(pub).toEqual([]);
  });
});
