import { describe, expect, it } from "vitest";
import { mapSiteSettings, type SiteSettings } from "@/lib/site-settings-map";
import { parseWhatsAppTarget } from "@/lib/whatsapp";
import { GROUPS, PUBLIC_KEYS, settingEntries } from "./settings-schema";

const FALLBACK: SiteSettings = {
  name: "Cloud RDP VPS",
  supportEmail: "built-in@example.com",
  telegram: "https://t.me/built-in",
  whatsapp: null,
  reviewEta: null,
  deliveryEta: null,
  announcement: { enabled: false, text: "", href: "", tone: "info" },
  maintenance: { enabled: false, message: "" },
};

const general = (over: Record<string, string> = {}) => ({ site_name: "Cloud RDP VPS", support_email: "", whatsapp: "", telegram: "", company_block: "", ...over });

function save(group: keyof typeof GROUPS, values: Record<string, string | boolean>) {
  const parsed = GROUPS[group].safeParse(values);
  if (!parsed.success) return { ok: false as const, errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  return { ok: true as const, entries: settingEntries(group, parsed.data as Record<string, unknown>) };
}

describe("saving Admin → Settings", () => {
  it("saves the WhatsApp number with the other General fields left empty", () => {
    const r = save("general", general({ whatsapp: "+92 309 3871661" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.fromEntries(r.entries).whatsapp).toBe("https://wa.me/923093871661");
  });

  it.each(["+92 309 3871661", "* 92 309 3871661", "92 309 3871661", "https://wa.me/923093871661", "wa.me/923093871661"])("accepts %s", (typed) => {
    const r = save("general", general({ whatsapp: typed }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.fromEntries(r.entries).whatsapp).toBe("https://wa.me/923093871661");
  });

  it("never produces a null value — site_settings.value is NOT NULL and a JSON null arrives as SQL NULL", () => {
    const cases: [keyof typeof GROUPS, Record<string, string | boolean>][] = [
      ["general", general()],
      ["general", general({ whatsapp: "+92 309 3871661", telegram: "https://t.me/cloudrdp", support_email: "help@cloudrdpvps.com", company_block: "Cloud RDP VPS\nLahore" })],
      ["orders", { unpaid_order_hours: "48", reject_extension_hours: "24", max_open_orders: "3", grace_days: "2", reminder_days: "3, 1", review_eta: "", delivery_eta: "" }],
      ["operations", { maintenance_enabled: false, maintenance_message: "", low_stock_threshold: "3" }],
      ["security", { require_staff_mfa: true }],
    ];
    for (const [group, values] of cases) {
      const r = save(group, values);
      expect(r.ok, group).toBe(true);
      if (!r.ok) continue;
      for (const [key, value] of r.entries) {
        expect(value, `${group}.${key}`).not.toBeNull();
        expect(value, `${group}.${key}`).not.toBeUndefined();
      }
    }
  });

  it("stores a cleared optional field as an empty string and keeps the others", () => {
    const r = save("general", general({ whatsapp: "+92 309 3871661", telegram: "https://t.me/cloudrdp" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.fromEntries(r.entries)).toEqual({
      site_name: "Cloud RDP VPS",
      support_email: "",
      whatsapp: "https://wa.me/923093871661",
      telegram: "https://t.me/cloudrdp",
      company_block: "",
    });
  });

  it("explains what is wrong with a number that has no country code", () => {
    const r = save("general", general({ whatsapp: "03093871661" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.whatsapp?.[0]).toMatch(/country code/i);
  });

  it("marks the contact settings public so the site can read them, and the rest staff-only", () => {
    for (const k of ["whatsapp", "telegram", "support_email", "site_name", "maintenance"]) expect(PUBLIC_KEYS.has(k), k).toBe(true);
    for (const k of ["company_block", "grace_days", "require_staff_mfa"]) expect(PUBLIC_KEYS.has(k), k).toBe(false);
  });

  it("what is saved is what the site shows: the number appears, and an emptied field hides its item", () => {
    const r = save("general", general({ whatsapp: "* 92 309 3871661" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rows = r.entries.map(([key, value]) => ({ key, value }));
    const site = mapSiteSettings(rows, FALLBACK, Date.now());
    expect(site.whatsapp).toBe("https://wa.me/923093871661");
    expect(parseWhatsAppTarget(site.whatsapp)?.phone).toBe("923093871661");
    // "" means "not set": hidden, not replaced by the built-in value
    expect(site.telegram).toBeNull();
    expect(site.supportEmail).toBeNull();
  });
});
