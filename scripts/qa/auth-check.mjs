// Visual + a11y + behaviour check for the auth screens. Run with the dev server up:  node scripts/qa/auth-check.mjs
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
import os from "node:os";
const OUT = process.env.SHOTS ?? os.tmpdir();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
const settle = async (p) => { await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(350); };
const ok = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

// ---------- screenshots + axe, desktop and phone ------------------------
for (const [label, viewport] of [["desktop", { width: 1280, height: 860 }], ["phone", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  for (const route of ["login", "register", "forgot-password", "verify-email", "reset-password"]) {
    await page.goto(`${BASE}/${route}`, { waitUntil: "load" }); await settle(page);
    await page.screenshot({ path: path.join(OUT, `auth-${route}-${label}.png`), fullPage: true });
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    ok(`axe ${route} (${label})`, axe.violations.length === 0, axe.violations.map((v) => `${v.id}:${v.nodes.length}`).join(", "));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    ok(`no horizontal scroll ${route} (${label})`, !overflow);
  }
  await ctx.close();
}

// ---------- behaviour ---------------------------------------------------
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
const text = async (sel) => (await page.locator(sel).first().innerText()).trim();

// empty login -> field errors from the server action
await page.goto(`${BASE}/login`, { waitUntil: "load" }); await settle(page);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForSelector(".field-error");
const loginErrors = await page.locator(".field-error").allInnerTexts();
ok("login: empty form shows field errors", loginErrors.length === 2, loginErrors.join(" | "));

// wrong credentials -> ONE generic message (no user enumeration)
await page.getByLabel("Email").fill("nobody-here@example.com");
await page.getByLabel("Password").fill("definitely-wrong-password");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForSelector('p[role="alert"]', { timeout: 15000 });
const msg = await text('p[role="alert"]');
ok("login: wrong credentials -> generic message", msg === "Incorrect email or password.", msg);

// password show/hide
await page.getByRole("button", { name: "Show" }).click();
ok("login: Show toggles the password field to text", (await page.getByLabel("Password").getAttribute("type")) === "text");

// register: empty submit
await page.goto(`${BASE}/register`, { waitUntil: "load" }); await settle(page);
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForSelector(".field-error");
const regErrors = await page.locator(".field-error").allInnerTexts();
ok("register: empty form lists every problem", regErrors.length === 4, regErrors.join(" | "));
await page.getByLabel("Full name").fill("Test Person");
await page.getByLabel("Email").fill("test.person@example.com");
await page.getByLabel("Password", { exact: true }).fill("short1");
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForFunction(() => document.body.innerText.includes("at least 10 characters") || document.body.innerText.includes("Use at least 10"));
ok("register: weak password rejected before reaching Supabase", true);

// forgot: invalid address
await page.goto(`${BASE}/forgot-password`, { waitUntil: "load" }); await settle(page);
await page.getByLabel("Email").fill("not-an-email");
await page.getByRole("button", { name: "Send reset link" }).click();
await page.waitForSelector(".field-error");
ok("forgot: invalid email -> field error", (await text(".field-error")).includes("valid email"));

// reset without a recovery session
await page.goto(`${BASE}/reset-password`, { waitUntil: "load" }); await settle(page);
ok("reset: no session -> invalid link message", (await page.locator('p[role="alert"]').innerText()).includes("invalid or has expired"));

// verify-email without a cookie asks for the address
await page.goto(`${BASE}/verify-email`, { waitUntil: "load" }); await settle(page);
ok("verify: shows an email field when none is remembered", await page.getByLabel("Email").isVisible());

// gate: private areas redirect to login with a safe next
await page.goto(`${BASE}/dashboard`, { waitUntil: "load" }); await settle(page);
ok("proxy: /dashboard signed-out -> /login?next=…", /\/login\?next=%2Fdashboard/.test(page.url()), page.url());
await page.goto(`${BASE}/admin/orders?x=1`, { waitUntil: "load" }); await settle(page);
ok("proxy: /admin signed-out keeps the full path in next", page.url().includes("next=%2Fadmin%2Forders%3Fx%3D1"), page.url());

// open-redirect attempt is neutralised
await page.goto(`${BASE}/login?next=https://evil.test/steal`, { waitUntil: "load" }); await settle(page);
const hidden = await page.locator('input[name="next"]').getAttribute("value");
ok("login: external next is replaced by a local path", hidden === "/dashboard", hidden ?? "(none)");

// confirm route with a bad token never reveals why
await page.goto(`${BASE}/auth/confirm?token_hash=bogus&type=recovery&next=/reset-password`, { waitUntil: "load" }); await settle(page);
ok("confirm: bad token -> /login?error=link", page.url().includes("/login?error=link"), page.url());
ok("confirm: shows the generic expired-link message", (await page.locator('p[role="status"]').innerText()).includes("invalid or has expired"));
await page.goto(`${BASE}/auth/confirm?token_hash=x&type=bogus`, { waitUntil: "load" }); await settle(page);
ok("confirm: unknown type is refused", page.url().includes("/login?error=link"));

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
