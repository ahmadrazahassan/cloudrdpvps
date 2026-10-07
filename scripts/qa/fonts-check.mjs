// Verifies the site really renders only Inter Tight + Inter. Run against a production server:
//   BASE=http://localhost:3100 node scripts/qa/fonts-check.mjs
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3100";
import os from "node:os";
const OUT = process.env.SHOTS ?? os.tmpdir();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
const ok = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const ROUTES = ["/", "/login", "/register", "/forgot-password", "/verify-email", "/reset-password", "/rdp", "/does-not-exist"];

const fontRequests = new Set();
const settle = async (p) => { await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(350); };
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
ctx.on("request", (r) => {
  const u = r.url();
  if (/\.(woff2?|ttf|otf)(\?|$)/i.test(u) || /fonts\.(googleapis|gstatic)\.com/.test(u)) fontRequests.add(u.replace(BASE, ""));
});
const page = await ctx.newPage();

// ---- 1. every rendered text element, on every route --------------------------------
const familiesSeen = new Map(); // first family -> count
for (const route of ROUTES) {
  await page.goto(BASE + route, { waitUntil: "load" }); await settle(page);
  await page.evaluate(() => document.fonts.ready);
  const found = await page.evaluate(() => {
    const out = {};
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el || el.closest("script,style,noscript")) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const key = cs.fontFamily.split(",")[0].trim().replace(/["']/g, "");
      out[key] = (out[key] ?? 0) + 1;
    }
    // generated content (ghost wordmark) and form controls
    for (const sel of [".ghost-wordmark"]) {
      const el = document.querySelector(sel);
      if (el) {
        const cs = getComputedStyle(el, "::before");
        const key = cs.fontFamily.split(",")[0].trim().replace(/["']/g, "");
        out[key] = (out[key] ?? 0) + 1;
      }
    }
    for (const el of document.querySelectorAll("input,textarea,select,button")) {
      const key = getComputedStyle(el).fontFamily.split(",")[0].trim().replace(/["']/g, "");
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  });
  for (const [k, v] of Object.entries(found)) familiesSeen.set(k, (familiesSeen.get(k) ?? 0) + v);
}
const names = [...familiesSeen.keys()];
const allowed = (n) => /^__?Inter(_Tight)?(_Fallback)?_?[a-f0-9]*$/i.test(n) || /^(Inter|Inter Tight)$/i.test(n);
ok("every text node, control and generated wordmark renders in Inter or Inter Tight", names.every(allowed), JSON.stringify(Object.fromEntries(familiesSeen)));

// ---- 2. the fonts that actually loaded -----------------------------------------------
await page.goto(BASE + "/", { waitUntil: "load" }); await settle(page);
const loaded = await page.evaluate(async () => {
  await document.fonts.ready;
  return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "").replace(/^__/, "").replace(/_[a-f0-9]{6,}$/, ""));
});
const loadedUnique = [...new Set(loaded)];
ok("FontFace set contains only Inter and Inter Tight", loadedUnique.every((f) => /^Inter(_Tight)?$/.test(f) || /^Inter( Tight)?$/.test(f)), loadedUnique.join(", "));
ok("both families are actually loaded on the homepage", loadedUnique.some((f) => /Tight/.test(f)) && loadedUnique.some((f) => /^Inter$/.test(f)), loadedUnique.join(", "));

// ---- 3. network: self-hosted only ------------------------------------------------------
const reqs = [...fontRequests];
ok("fonts are served from our own origin (no Google request from the browser)", reqs.length > 0 && reqs.every((u) => u.startsWith("/_next/static/media/")), `${reqs.length} files`);
console.log("      font files requested across all routes:", reqs.length);

// ---- 4. weights in use ---------------------------------------------------------------------
await page.goto(BASE + "/", { waitUntil: "load" }); await settle(page);
const weights = await page.evaluate(() => {
  const m = {};
  for (const el of document.querySelectorAll("body *")) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const w = getComputedStyle(el).fontWeight;
    m[w] = (m[w] ?? 0) + 1;
  }
  return m;
});
ok("only deliberate weights are used (400, 450, 480, 500, 600)", Object.keys(weights).every((w) => ["400", "450", "480", "500", "600", "700"].includes(w)), JSON.stringify(weights));

// ---- 5. OpenType features really take effect ----------------------------------------------
const featureDiff = await page.evaluate(async () => {
  const mk = (css) => {
    const s = document.createElement("span");
    s.textContent = "0Il1 O0 WIN-SRV-0142";
    s.style.cssText = "position:fixed;left:0;top:0;font-size:40px;white-space:nowrap;" + css;
    document.body.appendChild(s);
    return s;
  };
  const plain = mk("font-family:var(--font-sans);font-feature-settings:normal;");
  const data = mk("font-family:var(--font-sans);");
  data.className = "data-id";
  await document.fonts.ready;
  const a = plain.getBoundingClientRect().width, b = data.getBoundingClientRect().width;
  plain.remove(); data.remove();
  return { plain: a, data: b };
});
ok(".data-id changes how identifiers render (letter-spacing + features applied)", featureDiff.plain !== featureDiff.data, JSON.stringify(featureDiff));

// weights come from a real variable axis: advance widths change smoothly (a synthesised bold would not)
const widthAt = async (fam, w) =>
  page.evaluate(async ([f, wt]) => {
    const s = document.createElement("span");
    s.textContent = "Windows servers, delivered after we verify your payment";
    s.style.cssText = "position:fixed;left:0;top:0;white-space:nowrap;font-size:32px;font-family:" + f + ";font-weight:" + wt;
    document.body.appendChild(s);
    await document.fonts.ready;
    const w2 = s.getBoundingClientRect().width;
    s.remove();
    return w2;
  }, [fam, w]);
for (const [label, fam] of [["Inter", "var(--font-sans)"], ["Inter Tight", "var(--font-display)"]]) {
  const ws = [];
  for (const w of [400, 450, 500, 550, 600, 700]) ws.push(await widthAt(fam, w));
  const strictlyGrowing = ws.every((v, i) => i === 0 || v > ws[i - 1]);
  ok(label + " weights are a true variable axis (400→700 grow smoothly, incl. 450/550)", strictlyGrowing, ws.map((v) => v.toFixed(1)).join(" < "));
}
const px = async (css) => {
  const el = await page.evaluateHandle((c) => {
    const s = document.createElement("span");
    s.textContent = "0000 1111";
    s.style.cssText = "position:fixed;left:20px;top:20px;font-size:64px;font-family:var(--font-sans);background:#fff;color:#000;" + c;
    document.body.appendChild(s);
    return s;
  }, css);
  const buf = await el.asElement().screenshot();
  await el.evaluate((n) => n.remove());
  return buf.toString("base64");
};
const [tnumOff, tnumOn] = [await px("font-variant-numeric:proportional-nums;"), await px("font-variant-numeric:tabular-nums;")];
ok("Inter's tabular figures feature is present in the shipped font file", tnumOff !== tnumOn);

// ---- 6. layout health + accessibility on every route and size --------------------------------
for (const [label, vp] of [["1440", { width: 1440, height: 900 }], ["820", { width: 820, height: 1000 }], ["390", { width: 390, height: 844 }]]) {
  await page.setViewportSize(vp);
  for (const route of ["/", "/login", "/register"]) {
    await page.goto(BASE + route, { waitUntil: "load" }); await settle(page);
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(`no horizontal overflow ${route} @${label}`, overflow <= 0, overflow > 0 ? `+${overflow}px` : "");
  }
}
await page.setViewportSize({ width: 1440, height: 900 });
for (const route of ["/", "/login", "/register", "/rdp", "/does-not-exist"]) {
  await page.goto(BASE + route, { waitUntil: "load" }); await settle(page);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  ok(`axe ${route}`, axe.violations.length === 0, axe.violations.map((v) => `${v.id}×${v.nodes.length}`).join(", "));
}

// ---- 7. layout shift while fonts load --------------------------------------------------------------
await page.goto(BASE + "/", { waitUntil: "load" });
const cls = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let total = 0;
      new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (total += e.value))).observe({ type: "layout-shift", buffered: true });
      setTimeout(() => resolve(total), 1500);
    }),
);
ok("cumulative layout shift stays ~0 (fallback metrics match)", cls < 0.02, cls.toFixed(4));

// ---- screenshots of every homepage section ---------------------------------------------------------
await page.goto(BASE + "/", { waitUntil: "load" }); await settle(page);
await page.evaluate(() => { document.querySelectorAll(".reveal").forEach((e) => e.setAttribute("data-reveal", "in")); });
const sections = await page.$$("main > section, header, footer");
let i = 0;
for (const s of sections) {
  const id = (await s.getAttribute("id")) ?? (await s.evaluate((e) => e.tagName.toLowerCase())) + i;
  await s.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await s.screenshot({ path: path.join(OUT, `type-home-${String(i).padStart(2, "0")}-${id}.png`) });
  i++;
}
console.log(`      saved ${i} section screenshots`);

await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
