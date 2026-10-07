import type { ReactNode } from "react";
import { AuthHintSync } from "@/components/marketing/auth-hint-sync";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { WhatsAppChat } from "@/components/marketing/whatsapp-chat";
import { AUTH_HINT_SCRIPT } from "@/lib/auth-hint";

/** Skip link + header + main + footer + the floating WhatsApp chat. Used by the (marketing) layout and the site-wide 404. */
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Runs before the first paint so a signed-in visitor never sees "Log in" flash (see lib/auth-hint.ts). */}
      <script dangerouslySetInnerHTML={{ __html: AUTH_HINT_SCRIPT }} />
      <AuthHintSync />
      <a
        href="#main"
        className="sr-only z-[80] rounded-btn bg-ink px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
      <WhatsAppChat />
    </>
  );
}
