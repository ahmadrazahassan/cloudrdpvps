import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderEmail, type EmailContext } from "./templates";

const ctx: EmailContext = { siteName: "Cloud RDP VPS", siteUrl: "https://example.com", supportEmail: null };
const root = process.cwd();

/**
 * Every email the database queues is named in a migration (`enqueue_email(..., 'order_placed', ...)`,
 * `alert_staff('staff_ticket', ...)`). If a migration names a template this app can't render, that email is
 * marked failed instead of sent — so keep the two lists in step.
 */
describe("every template the database queues can be rendered", () => {
  const sql = readdirSync(path.join(root, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(path.join(root, "supabase/migrations", f), "utf8"))
    .join("\n");
  const names = new Set([
    ...[...sql.matchAll(/enqueue_email\(\s*[\w.]+\s*,\s*'(\w+)'/g)].map((m) => m[1]!),
    ...[...sql.matchAll(/alert_staff\(\s*'(\w+)'/g)].map((m) => m[1]!),
  ]);

  it("finds the templates the migrations queue", () => {
    for (const expected of ["order_placed", "payment_approved", "service_delivered", "ticket_reply", "staff_payment_submitted"]) {
      expect(names).toContain(expected);
    }
  });

  it.each([...names])("%s", (name) => {
    expect(renderEmail(name, {}, ctx), `no template for “${name}”`).not.toBeNull();
  });
});

/** The six emails Supabase Auth sends (through Resend SMTP) use the files in supabase/templates. */
describe("supabase/templates", () => {
  const dir = path.join(root, "supabase/templates");
  const files = readdirSync(dir).filter((f) => f.endsWith(".html"));
  const ALLOWED = new Set([".SiteURL", ".TokenHash", ".Token", ".Email", ".NewEmail"]);

  it("covers every email type the app can trigger", () => {
    expect(files.sort()).toEqual(["change-email.html", "confirm-signup.html", "invite.html", "magic-link.html", "reauthentication.html", "reset-password.html"]);
  });

  it.each(files)("%s only uses placeholders Supabase provides, and a valid confirm link or code", (file) => {
    const html = readFileSync(path.join(dir, file), "utf8");
    const used = [...html.matchAll(/\{\{\s*([^}\s]*)\s*\}\}/g)].map((m) => m[1]!);
    expect(used.length).toBeGreaterThan(0);
    for (const p of used) expect(ALLOWED.has(p), `${file} uses {{ ${p} }}`).toBe(true);
    expect(html).not.toMatch(/\{\{\s*\}\}/); // an empty action is a template parse error in Supabase
    if (file === "reauthentication.html") {
      expect(html).toContain("{{ .Token }}");
    } else {
      // Same shape as /auth/confirm expects: token_hash + a type it accepts + a same-site next.
      expect(html).toMatch(/\{\{ \.SiteURL \}\}\/auth\/confirm\?token_hash=\{\{ \.TokenHash \}\}&amp;type=(signup|recovery|email_change|invite|magiclink)&amp;next=\//);
    }
    expect(html).toContain("/brand/logo-black.png");
  });
});
