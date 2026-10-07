import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";
import { addressLines, type EmailContext } from "./layout";

/** The site name, address, support email and company details every email shares, read from Admin → Settings (with safe fallbacks). */
export async function loadEmailContext(db: SupabaseClient<Database>): Promise<EmailContext> {
  const settings = await db.from("site_settings").select("key, value").in("key", ["support_email", "site_name", "company_block"]);
  const map = new Map((settings.data ?? []).map((r) => [r.key, r.value]));
  return {
    siteName: typeof map.get("site_name") === "string" ? (map.get("site_name") as string) : "Cloud RDP VPS",
    siteUrl: publicEnv.siteUrl,
    supportEmail: typeof map.get("support_email") === "string" ? ((map.get("support_email") as string).trim() || null) : null,
    address: addressLines(map.get("company_block")),
  };
}
