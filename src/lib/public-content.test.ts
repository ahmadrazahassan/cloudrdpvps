import { describe, expect, it } from "vitest";
import { faqCategories, faqs as builtIn, homeFaqs } from "@/content/faqs";
import { escapeHtml, renderEmail, type EmailContext } from "@/lib/email/templates";
import { mapFaqRows, plainText, type FaqContent } from "@/lib/faqs-map";
import { mapSiteSettings, type SiteSettings } from "@/lib/site-settings-map";

const ctx: EmailContext = { siteName: "Cloud RDP VPS", siteUrl: "https://example.com", supportEmail: "help@example.com" };

describe("renderEmail", () => {
  const templates: [string, Record<string, unknown>][] = [
    ["order_placed", { order_number: "CRV-1", total_cents: 2500, order_id: "o1" }],
    ["payment_under_review", { order_number: "CRV-1", order_id: "o1" }],
    ["payment_approved", { order_number: "CRV-1", order_id: "o1" }],
    ["payment_rejected", { order_number: "CRV-1", order_id: "o1", reason: "Unreadable proof" }],
    ["renewal_confirmed", { order_number: "CRV-1", service_id: "s1", expires_at: "2026-12-01T00:00:00Z" }],
    ["service_delivered", { order_number: "CRV-1", service_id: "s1", label: "Web 01" }],
    ["service_expired", { service_id: "s1", label: "Web 01" }],
    ["expiring_soon", { service_id: "s1", label: "Web 01", expires_at: "2026-12-01T00:00:00Z", days: 3 }],
    ["account_suspended", { reason: "Abuse report" }],
    ["ticket_reply", { ticket_id: "t1", ticket_no: 48, subject: "Cannot connect" }],
    ["staff_payment_submitted", { payment_id: "p1", order_number: "CRV-1", amount_cents: 2500, method: "JazzCash", type: "new" }],
    ["staff_ticket", { ticket_id: "t1", ticket_no: 9, subject: "Help", is_new: true, priority: "high" }],
    ["staff_contact", { name: "Bilal", topic: "Sales" }],
    ["test", {}],
  ];

  it.each(templates)("renders %s with a subject, text, html and an absolute link", (name, data) => {
    const mail = renderEmail(name, data, ctx);
    expect(mail).not.toBeNull();
    expect(mail!.subject.length).toBeGreaterThan(5);
    expect(mail!.text).toContain("Cloud RDP VPS");
    if (name !== "test") expect(mail!.text).toMatch(/https:\/\/example\.com\/(dashboard|admin)/);
    expect(mail!.html).toContain("<!doctype html>");
  });

  it("never asks for or includes a password, even if one is handed in by mistake", () => {
    const mail = renderEmail("service_delivered", { service_id: "s1", label: "Web 01", password: "hunter2-SECRET", username: "Administrator" }, ctx)!;
    expect(mail.text + mail.html).not.toMatch(/hunter2|SECRET|Administrator/);
    expect(mail.text).toMatch(/sign in to your dashboard/i);
  });

  it("escapes anything a customer typed", () => {
    const mail = renderEmail("ticket_reply", { ticket_id: "t1", ticket_no: 1, subject: '<script>alert("x")</script>' }, ctx)!;
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(escapeHtml(`"'&<>`)).toBe("&quot;&#39;&amp;&lt;&gt;");
  });

  it("returns null for an unknown template", () => {
    expect(renderEmail("nope", {}, ctx)).toBeNull();
  });
});

describe("mapSiteSettings", () => {
  const fallback: SiteSettings = {
    name: "Fallback",
    supportEmail: "built-in@example.com",
    telegram: null,
    whatsapp: null,
    reviewEta: null,
    deliveryEta: null,
    announcement: { enabled: false, text: "", href: "", tone: "info" },
    maintenance: { enabled: false, message: "" },
  };
  const NOW = Date.parse("2026-06-15T12:00:00Z");

  it("uses stored values and treats an explicit null as 'hide it'", () => {
    const s = mapSiteSettings([{ key: "support_email", value: null }, { key: "whatsapp", value: "https://wa.me/1" }, { key: "site_name", value: "Acme" }], fallback, NOW);
    expect(s.supportEmail).toBeNull(); // the owner cleared it: don't resurrect the built-in default
    expect(s.whatsapp).toBe("https://wa.me/1");
    expect(s.name).toBe("Acme");
    expect(s.telegram).toBeNull();
  });

  it("falls back when a key isn't in the table at all", () => {
    expect(mapSiteSettings([], fallback, NOW).supportEmail).toBe("built-in@example.com");
  });

  it("shows the announcement only inside its schedule", () => {
    const base = { enabled: true, text: "Sale", link: "/pricing", tone: "warn" };
    const at = (a: object) => mapSiteSettings([{ key: "announcement", value: { ...base, ...a } }], fallback, NOW).announcement;
    expect(at({}).enabled).toBe(true);
    expect(at({}).tone).toBe("warn");
    expect(at({ starts_at: "2026-06-16T00:00:00Z" }).enabled).toBe(false); // not started
    expect(at({ ends_at: "2026-06-14T00:00:00Z" }).enabled).toBe(false); // already over
    expect(at({ starts_at: "2026-06-01T00:00:00Z", ends_at: "2026-07-01T00:00:00Z" }).enabled).toBe(true);
    expect(at({ enabled: false }).enabled).toBe(false);
    expect(at({ text: "  " }).enabled).toBe(false); // no text, nothing to show
  });

  it("reads maintenance mode", () => {
    expect(mapSiteSettings([{ key: "maintenance", value: { enabled: true, message: "Back soon" } }], fallback, NOW).maintenance).toEqual({ enabled: true, message: "Back soon" });
  });
});

describe("mapFaqRows", () => {
  const base: FaqContent = { faqs: builtIn, categories: faqCategories, home: homeFaqs };
  const homeIds = new Set(homeFaqs.map((f) => f.id));

  it("keeps the built-in content while the table is empty", () => {
    expect(mapFaqRows([], base, homeIds)).toBe(base);
  });

  it("uses database rows, keeps known categories first and adds new ones", () => {
    const out = mapFaqRows(
      [
        { slug: "delivery", category: "ordering", question: "Q1", answer_md: "A1", sort_order: 1 },
        { slug: "mine", category: "billing-tips", question: "Q2", answer_md: "A2", sort_order: 2 },
      ],
      base,
      homeIds,
    );
    expect(out.faqs.map((f) => f.id)).toEqual(["delivery", "mine"]);
    expect(out.categories.map((c) => c.id)).toEqual(["ordering", "billing-tips"]);
    expect(out.categories[1]!.label).toBe("Billing Tips");
    expect(out.home.map((f) => f.id)).toEqual(["delivery"]); // flagged as a homepage question
  });

  it("falls back to the first few questions for the homepage when none are flagged", () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({ slug: `x${i}`, category: "misc", question: `Q${i}`, answer_md: "A", sort_order: i }));
    expect(mapFaqRows(rows, base, homeIds).home).toHaveLength(4);
  });

  it("turns markdown into plain text for structured data", () => {
    expect(plainText("Use **bold** and [a link](https://x.test).\n\n- one\n- two")).toBe("Use bold and a link. one two");
  });
});
