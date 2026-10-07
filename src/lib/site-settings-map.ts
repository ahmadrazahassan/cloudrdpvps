/** Public site settings: the rows of `site_settings` the website reads, turned into plain values. Pure, so it is testable. */

export interface SiteSettings {
  name: string;
  supportEmail: string | null;
  telegram: string | null;
  whatsapp: string | null;
  reviewEta: string | null;
  deliveryEta: string | null;
  /** Already filtered by the schedule: `enabled` is true only while it should be on screen. */
  announcement: { enabled: boolean; text: string; href: string; tone: "info" | "warn" };
  maintenance: { enabled: boolean; message: string };
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function mapSiteSettings(rows: { key: string; value: unknown }[], fallback: SiteSettings, nowMs: number): SiteSettings {
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const has = (k: string) => m.has(k);

  const a = obj(m.get("announcement"));
  const starts = typeof a.starts_at === "string" ? Date.parse(a.starts_at) : null;
  const ends = typeof a.ends_at === "string" ? Date.parse(a.ends_at) : null;
  const text = str(a.text) ?? "";
  const live = a.enabled === true && text !== "" && (starts === null || starts <= nowMs) && (ends === null || ends > nowMs);

  const mt = obj(m.get("maintenance"));

  return {
    name: str(m.get("site_name")) ?? fallback.name,
    // an explicit null in the database means "not set" and must hide the item, not fall back to a built-in value
    supportEmail: has("support_email") ? str(m.get("support_email")) : fallback.supportEmail,
    telegram: has("telegram") ? str(m.get("telegram")) : fallback.telegram,
    whatsapp: has("whatsapp") ? str(m.get("whatsapp")) : fallback.whatsapp,
    reviewEta: has("review_eta") ? str(m.get("review_eta")) : fallback.reviewEta,
    deliveryEta: has("delivery_eta") ? str(m.get("delivery_eta")) : fallback.deliveryEta,
    announcement: { enabled: live, text, href: str(a.link) ?? "", tone: a.tone === "warn" ? "warn" : "info" },
    maintenance: { enabled: mt.enabled === true, message: str(mt.message) ?? "" },
  };
}
