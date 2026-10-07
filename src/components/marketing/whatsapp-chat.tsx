import { publicEnv } from "@/lib/env";
import { getSiteSettings } from "@/lib/site-settings";
import { parseWhatsAppTarget } from "@/lib/whatsapp";
import { WhatsAppWidget } from "./whatsapp-widget";

/**
 * The floating WhatsApp chat. It reads the same setting as the footer and the contact page (Admin → Settings →
 * General → WhatsApp), so there is one place to change the number — and when that's empty, or isn't a WhatsApp
 * link we trust, nothing is rendered at all.
 */
export async function WhatsAppChat() {
  const settings = await getSiteSettings();
  const target = parseWhatsAppTarget(settings.whatsapp);
  if (!target) return null;
  return <WhatsAppWidget siteName={settings.name} siteUrl={publicEnv.siteUrl} target={target} />;
}
