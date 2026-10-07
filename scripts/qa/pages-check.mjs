// Checks every public page. Run against a production server:
//   BASE=http://localhost:3100 node scripts/qa/pages-check.mjs
// Optional: SHOTS=<dir> saves a desktop and a phone screenshot of each page.
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const ROUTES = [
  "/", "/rdp", "/vps", "/pricing", "/locations",
  "/locations/united-states", "/locations/india", "/locations/germany", "/locations/united-kingdom",
  "/features", "/faq", "/about", "/contact",
  "/legal", "/legal/terms", "/legal/privacy", "/legal/acceptable-use", "/legal/refund",
  "/this-page-does-not-exist",
];
const WIDTHS = [1440, 820, 390];

const browser = await chromium.launch({ channel: "chrome", headless: true });
let failures = 0;
const check = (route, name, pass, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${route.padEnd(26)} ${name}${detail ? "  — " + detail : ""}`);
};
// Wait out the 450 ms reveal-on-scroll fade, otherwise axe samples half-transparent text and reports false contrast failures.
const settle = async (p) => {
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(900);
};

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  // The 404 page legitimately logs "Failed to load resource: 404" for its own document.
  page.on("console", (m) => m.type() === "error" && !/status of 404/.test(m.text()) && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  for (const route of ROUTES) {
    const tag = `${route} @${width}`;
    consoleErrors.length = 0;
    const res = await page.goto(BASE + route, { waitUntil: "load" });
    await settle(page);

    const is404 = route === "/this-page-does-not-exist";
    check(tag, "status", res?.status() === (is404 ? 404 : 200), String(res?.status()));

    const info = await page.evaluate(() => {
      const de = document.documentElement;
      const h1 = document.querySelectorAll("h1").length;
      const bg = getComputedStyle(document.body).backgroundColor;
      // gradients anywhere except the glossy buttons
      const gradients = [];
      for (const el of document.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        const imgs = [cs.backgroundImage, getComputedStyle(el, "::before").backgroundImage, getComputedStyle(el, "::after").backgroundImage];
        if (imgs.some((i) => i.includes("gradient")) && !el.closest(".btn")) gradients.push(el.tagName + "." + String(el.className).slice(0, 40));
      }
      return { overflow: de.scrollWidth - de.clientWidth, h1, bg, gradients, title: document.title, lang: de.lang };
    });
    check(tag, "no horizontal overflow", info.overflow <= 0, `+${info.overflow}px`);
    check(tag, "one h1", info.h1 === 1, `${info.h1}`);
    check(tag, "background #F1F1F1", info.bg === "rgb(241, 241, 241)", info.bg);
    check(tag, "no gradient outside buttons", info.gradients.length === 0, info.gradients.slice(0, 3).join(", "));
    check(tag, "has title", info.title.length > 10, info.title);
    check(tag, "no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));

    if (width === 1440 || width === 390) {
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      check(tag, "axe wcag2.2 AA", axe.violations.length === 0,
        axe.violations.map((v) => `${v.id}(${v.nodes.length})`).join(", "));
    }

    if (SHOTS && (width === 1440 || width === 390)) {
      // Sections fade in as they scroll into view; scroll through so a full-page capture shows them all.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 90));
        }
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 700));
      });
      const file = path.join(SHOTS, `${route.replace(/\//g, "_") || "_home"}-${width}.png`);
      await page.screenshot({ path: file, fullPage: true });
    }
  }
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nAll page checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
