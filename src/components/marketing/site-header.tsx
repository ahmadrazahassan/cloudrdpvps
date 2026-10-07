import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SiteImage } from "@/components/shared/site-image";
import { ButtonLink } from "@/components/ui/button";
import { getCatalog, minPriceCents } from "@/lib/catalog";
import { getSiteSettings } from "@/lib/site-settings";
import { cn } from "@/lib/utils";
import { MainNav } from "./main-nav";
import { MobileNav } from "./mobile-nav";

export async function SiteHeader() {
  const [catalog, settings] = await Promise.all([getCatalog(), getSiteSettings()]);
  const rdpFrom = minPriceCents(catalog, "rdp");
  const vpsFrom = minPriceCents(catalog, "vps");
  const a = settings.announcement;
  const maintenance = settings.maintenance;

  return (
    <>
      {maintenance.enabled && (
        <div role="status" className="flex min-h-8 items-center justify-center border-b border-warn/40 px-4 py-1.5 text-center text-[12px] font-medium text-warn">
          {maintenance.message || "Ordering is paused for maintenance. Please check back shortly."}
        </div>
      )}
      {a.enabled && a.text && (
        <div
          className={cn(
            "flex h-8 items-center justify-center border-b border-line px-4 text-[11px] font-medium uppercase tracking-[0.06em]",
            a.tone === "warn" ? "text-warn" : "text-lav-700",
          )}
        >
          {a.href ? (
            <Link href={a.href} className="underline-offset-4 hover:underline">
              {a.text}
            </Link>
          ) : (
            a.text
          )}
        </div>
      )}
      <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="container-site flex h-16 items-stretch justify-between gap-6 xl:h-[72px]">
          <div className="flex items-stretch gap-6">
            <Logo className="self-center" />
            <MainNav
              rdpFrom={rdpFrom}
              vpsFrom={vpsFrom}
              rdpArt={<SiteImage name="product-rdp" />}
              vpsArt={<SiteImage name="product-vps" />}
            />
          </div>
          <div className="flex items-center gap-2">
            <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
              Log in
            </ButtonLink>
            <ButtonLink href="/#pricing" size="sm" className="hidden sm:inline-flex">
              Get started
              <ArrowRight size={14} strokeWidth={2} aria-hidden />
            </ButtonLink>
            <MobileNav rdpFrom={rdpFrom} vpsFrom={vpsFrom} />
          </div>
        </div>
      </header>
    </>
  );
}
