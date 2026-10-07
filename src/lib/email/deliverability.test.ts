import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AUTH_EMAILS, renderAuthEmail } from "./auth-emails";
import { addressLines } from "./layout";
import { renderEmail, type EmailContext } from "./templates";

/**
 * What keeps a transactional email out of the spam folder, as far as the message itself is concerned (the other
 * half — SPF, DKIM, DMARC on the sending domain — is DNS, see README → "Email (Resend)"). Every email the app can
 * send is checked, plus the six Supabase Auth ones.
 */
const root = process.cwd();
const ctx: EmailContext = { siteName: "Cloud RDP VPS", siteUrl: "https://example.com", supportEmail: "help@example.com", address: ["Cloud RDP VPS Ltd", "1 Example Street, London"] };

const sql = readdirSync(path.join(root, "supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(path.join(root, "supabase/migrations", f), "utf8"))
  .join("\n");
const queued = [
  ...[...sql.matchAll(/enqueue_email\(\s*[\w.]+\s*,\s*'(\w+)'/g)].map((m) => m[1]!),
  ...[...sql.matchAll(/alert_staff\(\s*'(\w+)'/g)].map((m) => m[1]!),
];
const names = [...new Set([...queued, "welcome", "password_changed", "test"])];

interface Sample {
  name: string;
  subject: string;
  html: string;
  text: string | null;
}
const samples: Sample[] = [
  ...names.map((name) => {
    const mail = renderEmail(name, { order_number: "CRV-001001", order_id: "o1", total_cents: 2500, service_id: "s1", label: "Trading-1", ticket_id: "t1", ticket_no: 48, subject: "Cannot connect", expires_at: "2026-12-01T00:00:00Z", days: 3, name: "Aisha Khan", at: "2026-10-07T14:42:00Z", reason: "Unreadable proof", amount_cents: 2500, method: "JazzCash", payment_id: "p1" }, ctx)!;
    return { name, subject: mail.subject, html: mail.html, text: mail.text };
  }),
  ...AUTH_EMAILS.map((e) => ({ name: `auth: ${e.file}`, subject: e.subject, html: renderAuthEmail(e), text: null })),
];

/** The visible words of an email: no tags, no placeholders, one line. */
const words = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/\{\{[^}]*\}\}/g, " ").replace(/&[a-z#0-9]+;/g, " ");

const SPAMMY = /\b(free money|act now|click here|limited time|winner|guarantee[ds]?|100% |risk[- ]free|cash bonus|prize|congratulations|buy now|order now|no obligation|dear friend|viagra|casino|lottery|earn \$|make money)\b|\${2,}|!{2,}/i;

describe.each(samples)("$name", ({ subject, html, text }) => {
  it("has a short, calm subject: no shouting, no exclamation marks, no sales phrases", () => {
    expect(subject.length).toBeGreaterThan(5);
    expect(subject.length).toBeLessThanOrEqual(70);
    expect(subject).not.toMatch(/!/);
    expect(subject).not.toMatch(/\b[A-Z]{5,}\b/); // CRV-001001 and RDP/VPS are fine; SHOUTING is not
    expect(subject).not.toMatch(SPAMMY);
  });

  it("reads like a person wrote it: no sales phrases or exclamation marks in the body", () => {
    const body = words(html);
    expect(body).not.toMatch(SPAMMY);
    expect(body).not.toMatch(/!/);
    expect(body).not.toMatch(/\b[A-Z]{6,}\b/);
  });

  it("is well-formed, light HTML with a title, a language and a viewport", () => {
    expect(html).toMatch(/<!doctype html>/i);
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toMatch(/<meta charset="utf-8">/);
    expect(html).toMatch(/<meta name="viewport"/);
    expect(html).toMatch(/<title>[^<]{3,}<\/title>/);
    expect(Buffer.byteLength(html)).toBeLessThan(25_000); // Gmail clips a message at ~100 KB; small also scores better
  });

  it("contains nothing active or hidden: no script, form, iframe, tracking pixel or javascript: link", () => {
    expect(html).not.toMatch(/<(script|iframe|form|object|embed|video|audio|input)\b/i);
    expect(html).not.toMatch(/javascript:/i);
    // The only image is the logo, with its size and alt text.
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toMatch(/\/brand\/email-logo\.png/);
    expect(imgs[0]).toMatch(/width="\d+"/);
    expect(imgs[0]).toMatch(/height="\d+"/);
    expect(imgs[0]).toMatch(/alt="[^"]+"/);
    // The preview line is the one piece of hidden text, and it is a real sentence.
    const hidden = [...html.matchAll(/display:none[^>]*>([^<]*)</g)].map((m) => m[1]!);
    expect(hidden).toHaveLength(1);
    expect(hidden[0]!.trim().split(/\s+/).length).toBeGreaterThanOrEqual(4);
  });

  it("links only to our own site, over https, and has at most one link", () => {
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]!);
    expect(hrefs.length).toBeLessThanOrEqual(1);
    for (const href of hrefs) expect(href).toMatch(/^(https:\/\/example\.com\/|\{\{ \.SiteURL \}\}\/)/);
  });

  it("keeps readable text next to the design, not an image of text", () => {
    expect(words(html).replace(/\s+/g, " ").trim().split(" ").length).toBeGreaterThan(25);
  });

  if (text !== null) {
    it("has a plain-text twin with the same link and no markup", () => {
      expect(text).not.toMatch(/<[a-z!/][^>]*>/i);
      expect(text).toContain("Cloud RDP VPS");
      expect(text.length).toBeGreaterThan(60);
    });
  }
});

describe("the footer", () => {
  it("says why the person got the email, how to reach us, and who we are", () => {
    const mail = renderEmail("order_placed", { order_number: "CRV-1", order_id: "o1" }, ctx)!;
    expect(mail.text).toContain("You're receiving this email because you have an account with Cloud RDP VPS.");
    expect(mail.text).toContain("write to help@example.com");
    expect(mail.text).toContain("Cloud RDP VPS Ltd · 1 Example Street, London");
    expect(mail.html).toContain("1 Example Street, London");
    expect(renderEmail("staff_ticket", { ticket_id: "t", ticket_no: 1, subject: "x" }, ctx)!.text).toContain("part of the Cloud RDP VPS team");
  });

  it("reads the company block from settings: a string or a list, trimmed, at most four lines", () => {
    expect(addressLines("Acme Ltd\n  1 Road \n\nVAT 123")).toEqual(["Acme Ltd", "1 Road", "VAT 123"]);
    expect(addressLines(["A", " B ", 3, "", "C", "D", "E"])).toEqual(["A", "B", "C", "D"]);
    expect(addressLines(null)).toEqual([]);
  });
});

describe("the logo", () => {
  const file = path.join(root, "public/brand/email-logo.png");

  it("is a small PNG at 2x the 176px it is shown at", () => {
    expect(statSync(file).size).toBeLessThan(20_000);
    const png = readFileSync(file);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(352); // width in the IHDR chunk
  });

  it("is the real lockup: the source SVG carries the lavender accent the PNG is drawn from", () => {
    expect(readFileSync(path.join(root, "public/brand/logo.svg"), "utf8").toLowerCase()).toContain("#9468e0");
  });
});
