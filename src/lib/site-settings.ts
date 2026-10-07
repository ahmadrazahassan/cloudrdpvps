import "server-only";
import { cache } from "react";
import { site } from "@/content/site";
import { now } from "@/lib/clock";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";
import { mapSiteSettings, type SiteSettings } from "./site-settings-map";

export type { SiteSettings };

const fallback = (): SiteSettings => ({
  name: site.name,
  supportEmail: site.supportEmail,
  telegram: site.telegram,
  whatsapp: site.whatsapp,
  reviewEta: null,
  deliveryEta: site.deliveryEta,
  announcement: { enabled: site.announcement.enabled, text: site.announcement.text, href: site.announcement.href, tone: site.announcement.tone },
  maintenance: { enabled: false, message: "" },
});

/**
 * What the owner controls from Admin → Settings and Content: support contacts, delivery ETA, the
 * announcement banner (only while its schedule says so) and maintenance mode. Public rows only, read through
 * the tagged public client so a save shows immediately. Any failure falls back to the built-in defaults.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  if (!isSupabaseConfigured) return fallback();
  try {
    const { data, error } = await createPublicClient().from("site_settings").select("key, value");
    if (error) throw error;
    return mapSiteSettings(data ?? [], fallback(), now());
  } catch (error) {
    console.error("[site-settings] falling back to defaults:", error instanceof Error ? error.message : error);
    return fallback();
  }
});
