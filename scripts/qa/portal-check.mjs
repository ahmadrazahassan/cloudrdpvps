// Checks the signed-in screens WITHOUT signing in: it takes the HTML that src/test/portal-render.test.tsx
// renders from realistic fixture data, puts it in a browser with the site's real stylesheet and fonts
// (taken from a running production server), and checks layout, colours and accessibility.
//
//   QA_OUT=./.qa/portal npx vitest run src/test/portal-render.test.tsx   # writes the snapshots
//   next start -p 3100                                                    # serves CSS + fonts
//   SNAPS=./.qa/portal BASE=http://localhost:3100 SHOTS=./.qa/shots node scripts/qa/portal-check.mjs
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3100";
const SNAPS = process.env.SNAPS;
const SHOTS = process.env.SHOTS;
if (!SNAPS) {
  console.error("Set SNAPS to the folder written by the render test (QA_OUT).");
  process.exit(2);
}
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

// The real <html class> (font variables) and stylesheet links, exactly as the site serves them.
const home = await (await fetch(BASE + "/")).text();
const htmlClass = /<html[^>]*class="([^"]*)"/.exec(home)?.[1] ?? "";
const links = [...home.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)]
  .map((m) => m[0].replace(/href="(\/[^"]*)"/, `href="${BASE}$1"`))
  .join("\n");
if (!links) throw new Error("Couldn't find the site's stylesheet — is `next start` running on " + BASE + "?");

const files = readdirSync(SNAPS).filter((f) => f.endsWith(".html")).sort();
const browser = await chromium.launch({ channel: "chrome", headless: true });
let failures = 0;
const check = (name, label, pass, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name.padEnd(28)} ${label}${detail ? "  — " + detail : ""}`);
};

for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  for (const file of files) {
    const name = `${file.replace(/\.html$/, "")} @${width}`;
    const fragment = readFileSync(path.join(SNAPS, file), "utf8");
    // Public pages (checkout) are fragments without the portal shell; give them the container the layout would.
    const doc = `<!doctype html><html lang="en" class="${htmlClass}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Snapshot — ${file}</title>${links}</head><body>${
      /^(checkout)/.test(file) ? `<main id="main">${fragment}</main>` : fragment
    }</body></html>`;
    await page.setContent(doc, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);

    const info = await page.evaluate(() => {
      const de = document.documentElement;
      const gradients = [];
      for (const el of document.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        if (cs.backgroundImage.includes("gradient") && !el.closest(".btn")) gradients.push(el.tagName + "." + String(el.className).slice(0, 40));
      }
      // The site font must be the only one in play (Inter / Inter Tight).
      const fonts = new Set();
      for (const el of document.querySelectorAll("body *")) {
        if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
          fonts.add(getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim());
        }
      }
      return {
        overflow: de.scrollWidth - de.clientWidth,
        bg: getComputedStyle(document.body).backgroundColor,
        gradients,
        fonts: [...fonts],
      };
    });
    check(name, "no horizontal overflow", info.overflow <= 0, `+${info.overflow}px`);
    check(name, "background #F1F1F1", info.bg === "rgb(241, 241, 241)", info.bg);
    check(name, "no gradient outside buttons", info.gradients.length === 0, info.gradients.slice(0, 3).join(", "));
    check(name, "only Inter / Inter Tight", info.fonts.every((f) => /^(__)?(Inter|inter)/i.test(f) || /Inter/i.test(f)), info.fonts.join(", "));

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    check(name, "axe wcag2.2 AA", axe.violations.length === 0, axe.violations.map((v) => `${v.id}(${v.nodes.length})`).join(", "));

    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${file.replace(/\.html$/, "")}-${width}.png`), fullPage: true });
  }
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nAll portal snapshot checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
