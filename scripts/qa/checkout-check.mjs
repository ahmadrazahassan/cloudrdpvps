// Drives the public checkout, redirects and contact form in a real browser, signed out. Run against a production server:
//   BASE=http://localhost:3100 node scripts/qa/checkout-check.mjs
// Nothing is created: no account is made (the sign-in / sign-up forms are only looked at, never submitted with real data),
// and the contact form is only submitted with invalid data (so it never stores a message).
// With DEMO_COUNTRIES=70 on the server it also exercises the country search at launch size.
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3100";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

let failures = 0;
const check = (name, pass, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const settle = () => page.waitForTimeout(500);
const summary = page.locator('[aria-label="Order summary"]');

// ---- 1. arriving with a plan and a country already chosen ------------------------------------------------------------
await page.goto(`${BASE}/order/new?product=rdp&country=united-states&plan=standard`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(1500);

check("the chosen plan and country are shown, not asked for again", (await page.getByText("RDP Standard").count()) > 0 && (await page.getByText("United States").count()) > 0 && (await page.getByRole("button", { name: /Change your plan/i }).count()) === 1);
check("it goes straight on to the account step", await page.getByRole("radio", { name: "Create account" }).isChecked());
check("sign-in and sign-up are on this page (no other page needed)", (await page.getByRole("radio", { name: "Sign in" }).count()) === 1 && page.url().includes("/order/new"));
check("the address now carries the whole choice and the step", /product=rdp/.test(page.url()) && /plan=standard/.test(page.url()) && /country=united-states/.test(page.url()) && /step=account/.test(page.url()), page.url());
check("the summary shows the live price", (await summary.getByText("$16").count()) > 0);
check("the Windows logo marks the operating system", (await page.locator("svg[fill='#0078D4']").count()) >= 2);
check("the header no longer lists Features, Support or FAQ", (await page.locator("header nav").getByRole("link", { name: /^(Features|Support|FAQ)$/ }).count()) === 0);

// ---- 2. changing the plan: segmented tabs, no lavender top rules ---------------------------------------------------
await page.getByRole("button", { name: /Change your plan/i }).click();
await settle();
check("Change reopens the plan step", /step=plan/.test(page.url()) && (await page.getByRole("radio", { name: /RDP Standard/ }).isChecked()));
check("operating system is a fixed fact, not a picker", (await summary.getByText("Windows Server").count()) > 0 && (await page.getByRole("combobox").count()) === 0);

await page.getByRole("radio", { name: "Windows VPS" }).check();
await settle();
check("switching product updates the URL", /product=vps/.test(page.url()), page.url());
check("VPS plans are listed", (await page.getByRole("radio", { name: /VPS M/ }).count()) === 1);

// ---- 3. the country list ---------------------------------------------------------------------------------------------
await page.getByRole("button", { name: /Change country/ }).click();
const dialog = page.getByRole("dialog");
await dialog.waitFor();
const countries = await dialog.getByRole("radio").count();
check("the country list opens with real names", (await dialog.getByRole("radio", { name: /United Kingdom/ }).count()) === 1, `${countries} countries`);
check("flags are real image files, not inline SVG", (await dialog.locator("img[src^='/flags/']").count()) >= 5 && (await dialog.locator("svg[viewBox*='3x2'], svg[class*='flag']").count()) === 0);
if (countries > 8) {
  await dialog.getByRole("searchbox", { name: "Search countries" }).fill("germ");
  await settle();
  check("typing narrows the list", (await dialog.getByRole("radio", { name: /Germany/ }).count()) === 1 && (await dialog.getByRole("radio").count()) < countries);
  await dialog.getByRole("searchbox", { name: "Search countries" }).fill("");
}
await dialog.getByRole("radio", { name: /United Kingdom/ }).click(); // choosing closes the list, so no .check() (it would wait on a radio that is gone)
await settle();
check("choosing a country closes the list and updates the URL", (await page.getByRole("dialog").count()) === 0 && /country=uk/.test(page.url()), page.url());

await page.getByRole("radio", { name: /VPS XL/ }).check();
await settle();
check("plan is in the URL and the summary follows", /plan=xl/.test(page.url()) && (await summary.getByText("VPS XL").count()) > 0 && (await summary.getByText("$78").count()) > 0);

// ---- 4. continuing: lands at the top of the next step, not the footer --------------------------------------------------
await page.getByRole("button", { name: "Continue" }).click();
await settle();
const top = await page.evaluate(() => {
  const el = document.querySelector("section[id$='-account']");
  return { top: el ? Math.round(el.getBoundingClientRect().top) : null, y: Math.round(window.scrollY), max: document.documentElement.scrollHeight - innerHeight };
});
check("the next step opens at the top of the page area (not scrolled to the footer)", top.top !== null && top.top >= 0 && top.top < 260 && top.y < top.max - 200, JSON.stringify(top));
check("step is in the address", /step=account/.test(page.url()), page.url());

// sign-in form, in place
await page.getByRole("radio", { name: "Sign in" }).check();
await settle();
check("sign-in fields appear in place", (await page.getByLabel("Email").count()) > 0 && (await page.getByLabel("Password").count()) > 0 && page.url().includes("/order/new"));
check("no lavender selection rule on the choices", (await page.locator("[class*='after:bg-lav-600']").count()) === 0);

// Back goes back a step, with the choice kept.
await page.goBack();
await settle();
check("Back returns to the plan step with the choice kept", /step=plan/.test(page.url()) && (await page.getByRole("radio", { name: /VPS XL/ }).isChecked()));

// ---- 5. addresses ------------------------------------------------------------------------------------------------------
await page.goto(`${BASE}/order/new?product=mainframe&country=atlantis&plan=nope`, { waitUntil: "load" });
await settle();
check("a nonsense URL still renders a valid selection", (await page.getByRole("radio", { checked: true }).count()) >= 1);

await page.goto(`${BASE}/order`, { waitUntil: "load" });
check("/order goes to /order/new", /\/order\/new/.test(page.url()), page.url());
await page.goto(`${BASE}/order/rdp/standard/united-states`, { waitUntil: "load" });
check("a path-style address becomes the full order address", /product=rdp/.test(page.url()) && /plan=standard/.test(page.url()) && /country=united-states/.test(page.url()), page.url());
await page.goto(`${BASE}/signup`, { waitUntil: "load" });
check("/signup goes to the registration page", /\/register/.test(page.url()), page.url());

// The renewal URL requires an account: signed out it goes to sign-in, not an error page.
const resp = await page.goto(`${BASE}/order/new?renew=00000000-0000-4000-8000-000000000000`, { waitUntil: "load" });
check("renewal while signed out redirects to sign-in", /\/login\?next=/.test(page.url()), page.url() + " " + resp?.status());

// The portal is closed to signed-out visitors.
await page.goto(`${BASE}/dashboard/orders`, { waitUntil: "load" });
check("the dashboard redirects to sign-in", /\/login\?next=%2Fdashboard%2Forders/.test(page.url()), page.url());
const rdp = await page.request.get(`${BASE}/dashboard/services/00000000-0000-4000-8000-000000000000/rdp`, { maxRedirects: 0 });
check("the .rdp download is not served to signed-out visitors", rdp.status() !== 200, String(rdp.status()));

// ---- 6. icons ----------------------------------------------------------------------------------------------------------
for (const [path, type] of [
  ["/favicon.ico", "image"],
  ["/icon.svg", "image"],
  ["/apple-icon.png", "image/png"],
  ["/manifest.webmanifest", "json"],
  ["/icons/icon-192.png", "image/png"],
]) {
  const r = await page.request.get(BASE + path);
  check(`${path} is served`, r.status() === 200 && (r.headers()["content-type"] ?? "").includes(type === "json" ? "json" : type), `${r.status()} ${r.headers()["content-type"]}`);
}

// ---- 7. sign-up keeps the destination ----------------------------------------------------------------------------------
await page.goto(`${BASE}/register?next=${encodeURIComponent("/order/new?product=vps&country=uk&plan=xl")}`, { waitUntil: "load" });
const hidden = await page.locator('input[name="next"]').getAttribute("value");
check("register carries the destination through", hidden === "/order/new?product=vps&country=uk&plan=xl", String(hidden));
await page.goto(`${BASE}/register?next=${encodeURIComponent("https://evil.example/")}`, { waitUntil: "load" });
check("register refuses an off-site destination", (await page.locator('input[name="next"]').count()) === 0 || (await page.locator('input[name="next"]').getAttribute("value")) === "/dashboard");

// ---- 8. contact form validation ----------------------------------------------------------------------------------------
await page.goto(`${BASE}/contact`, { waitUntil: "load" });
await settle();
await page.getByRole("button", { name: "Send message" }).click();
await page.waitForSelector(".field-error", { timeout: 8000 });
const messages = await page.locator(".field-error").allTextContents();
check("an empty contact form explains what's missing", messages.length >= 3, messages.join(" | "));

await page.getByLabel("Your name").fill("QA Check");
await page.getByLabel("Email").fill("not-an-email");
await page.getByLabel("What is this about?").selectOption("other");
await page.getByLabel("Message").fill("short");
await page.getByRole("button", { name: "Send message" }).click();
await page.waitForTimeout(1500);
const after = (await page.locator(".field-error").allTextContents()).join(" | ");
check("a bad email and a short message are rejected beside their fields", /valid email/i.test(after) && /at least 10/i.test(after), after);
check("the honeypot field is not visible or reachable", (await page.locator('main input[name="website"]').evaluate((el) => el.getBoundingClientRect().right < 0 && el.tabIndex === -1)));

const real = errors.filter((e) => !/status of (4\d\d)/.test(e));
check("no console errors", real.length === 0, real.slice(0, 2).join(" | "));

await browser.close();
console.log(failures === 0 ? "\nAll checkout checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
