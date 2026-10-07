import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BackToTop } from "@/components/marketing/footer/back-to-top";
import { FooterClock } from "@/components/marketing/footer/footer-clock";
import { FooterMarquee } from "@/components/marketing/footer/footer-marquee";
import { FooterQuestionForm } from "@/components/marketing/footer/footer-question-form";
import { CountryFlag } from "@/components/shared/primitives";
import { PaymentLogo } from "@/components/shared/payment-logo";
import { nav, site } from "@/content/site";
import { getCatalog } from "@/lib/catalog";
import type { Catalog } from "@/lib/catalog";
import { getSiteSettings } from "@/lib/site-settings";
import { cn, formatUsd } from "@/lib/utils";
import { parseWhatsAppTarget } from "@/lib/whatsapp";

/** How far down the rounded slot between the two panels reaches (px). The panels' top corners are 28px. */
const SLOT = 112;

const colHead = "text-[13px] text-white/55";
const colLink = "text-[16px] text-white transition-colors hover:text-lav-300";

/** The cheapest in-stock price at a location, across every plan. */
const fromPrice = (catalog: Catalog, locationId: string) => {
  const rows = catalog.pricing.filter((p) => p.locationId === locationId && p.stock !== "out_of_stock");
  return rows.length ? Math.min(...rows.map((r) => r.priceCents)) : null;
};

/**
 * Footer: a lavender call-to-action band, then one dark shape with a rounded slot cut into its top edge.
 * Left panel: a question form. Right panel: link columns and joined contact buttons.
 * Under a hairline: copyright, a live UTC clock, the legal links and a back-to-top button.
 * The shape is the one place the site uses a filled dark surface, by request.
 */
export async function SiteFooter() {
  const settings = await getSiteSettings();
  const chatShown = parseWhatsAppTarget(settings.whatsapp) !== null;
  // The footer also sits on the 404 and error pages, so a catalog hiccup must never take it down.
  const catalog = await getCatalog().catch(() => null);

  const locations = catalog
    ? catalog.locations.map((l) => {
        const from = fromPrice(catalog, l.id);
        return { name: l.name, href: `/locations/${l.slug}`, iso2: l.iso2, from };
      })
    : nav.footer.Locations.map((l) => ({ name: l.label, href: l.href, iso2: undefined, from: null }));

  // Up to three joined buttons: the contact channels that are set, topped up with always-available ones.
  const channels = [
    settings.telegram && { label: "Telegram", href: settings.telegram, external: true },
    settings.whatsapp && { label: "WhatsApp", href: settings.whatsapp, external: true },
    settings.supportEmail && { label: "Email us", href: `mailto:${settings.supportEmail}`, external: true },
    { label: "Open a ticket", href: "/dashboard/tickets/new", external: false },
    { label: "Contact us", href: "/contact", external: false },
    { label: "Read the FAQ", href: "/faq", external: false },
  ]
    .filter(Boolean)
    .slice(0, 3) as { label: string; href: string; external: boolean }[];
  const tints = ["bg-lav-100", "bg-lav-200", "bg-lav-300"];

  return (
    <footer aria-label="Site footer" className="bg-lav-300">
      <FooterMarquee />

      <div className="mx-3 mt-2 max-w-[1680px] sm:mx-4 md:mt-4 2xl:mx-auto">
        <div className="grid lg:grid-cols-[minmax(0,5fr)_16px_minmax(0,8fr)]">
          {/* Left: logo and the question form */}
          <section
            aria-labelledby="footer-ask"
            className="flex flex-col justify-between gap-14 rounded-t-[28px] bg-ink px-6 pb-10 pt-8 text-white sm:px-10 sm:pt-10"
          >
            <Logo tone="light" size="lg" className="self-start" />
            <div>
              <h2 id="footer-ask" className="flex items-start gap-3 font-display text-[21px] font-normal leading-snug tracking-[-0.015em] text-white">
                <span aria-hidden className="mt-[9px] h-2 w-2 shrink-0 rounded-full bg-lav-300" />
                <span>Questions before you order? Ask us here.</span>
              </h2>
              <FooterQuestionForm />
            </div>
          </section>

          {/* The slot between the panels: lavender shows through it, ending in a rounded bottom */}
          <div aria-hidden className="relative hidden bg-ink lg:block" style={{ marginTop: SLOT - 8 }}>
            <span className="absolute inset-x-0 top-0 h-2 bg-lav-300" style={{ borderRadius: "0 0 8px 8px" }} />
          </div>

          {/* Right: link columns and contact buttons */}
          <section
            aria-label="Site links"
            className="flex flex-col justify-between gap-14 bg-ink px-6 pb-10 pt-2 text-white sm:px-10 lg:rounded-t-[28px] lg:pt-[136px]"
          >
            <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
              <div>
                <p className={colHead}>Products</p>
                <ul className="mt-5 space-y-3">
                  {nav.footer.Products.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className={colLink}>
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className={colHead}>Company</p>
                <ul className="mt-5 space-y-3">
                  {nav.footer.Company.map((l) => (
                    <li key={l.label} data-auth-show={l.href === "/login" ? "out" : undefined}>
                      <Link href={l.href} className={colLink}>
                        {l.label}
                      </Link>
                    </li>
                  ))}
                  <li data-auth-show="in">
                    <Link href="/dashboard" className={colLink}>
                      Dashboard
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className={colHead}>Locations</p>
                <ul className="mt-5 space-y-4">
                  {locations.slice(0, 6).map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="group block">
                        <span className="inline-flex items-center gap-2 text-[16px] text-white transition-colors group-hover:text-lav-300">
                          {l.iso2 && <CountryFlag iso2={l.iso2} />}
                          {l.name}
                        </span>
                        {l.from !== null && (
                          <span className="num-tabular mt-0.5 block text-[13px] text-white/55">From {formatUsd(l.from)} / 30 days</span>
                        )}
                      </Link>
                    </li>
                  ))}
                  {locations.length > 6 && (
                    <li>
                      <Link href="/locations" className="text-[15px] font-medium text-lav-300 underline underline-offset-4 transition-colors hover:text-white">
                        All {locations.length} countries
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            </nav>

            {/* Joined buttons: 10px on the outer corners, 3px where they meet */}
            <ul className="flex flex-wrap gap-[2px]" aria-label="Get in touch">
              {channels.map((c, i) => {
                const last = channels.length - 1;
                const radius = {
                  borderTopLeftRadius: i === 0 ? 10 : 3,
                  borderBottomLeftRadius: i === 0 ? 10 : 3,
                  borderTopRightRadius: i === last ? 10 : 3,
                  borderBottomRightRadius: i === last ? 10 : 3,
                };
                const cls = `inline-flex h-[46px] items-center px-6 text-[15px] font-medium text-ink transition-colors hover:bg-white ${tints[i] ?? "bg-lav-300"}`;
                return (
                  <li key={c.label}>
                    {c.external ? (
                      <a href={c.href} style={radius} className={cls} {...(c.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                        {c.label}
                      </a>
                    ) : (
                      <Link href={c.href} style={radius} className={cls}>
                        {c.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {catalog && catalog.paymentMethods.length > 0 && (
          <section aria-label="Accepted payment methods" className="bg-ink px-6 text-white sm:px-10">
            <div className="flex flex-col gap-5 border-t border-white/15 py-7 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
              <div className="shrink-0">
                <p className="text-[14px] font-medium text-white">Accepted payment methods</p>
                <p className="mt-1 text-[12px] text-white/55">Available methods depend on your region.</p>
              </div>
              <ul className="flex flex-wrap gap-2.5">
                {catalog.paymentMethods.map((method) => (
                  <li key={method.id} className="inline-flex min-h-12 items-center gap-2.5 rounded-[10px] border border-white/10 bg-white/5 py-2 pl-2 pr-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-white">
                      <PaymentLogo name={method.name} type={method.type} className="max-h-6 max-w-6 object-contain" />
                    </span>
                    <span className="whitespace-nowrap text-[13px] font-medium text-white">{method.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Bottom bar, inside the same dark shape, under a hairline */}
        <div className="bg-ink px-6 text-white sm:px-10">
          {/* The floating WhatsApp launcher sits over the bottom-right corner, so the back-to-top button makes room for it. */}
          <div className={cn("flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-white/15 py-6", chatShown && "pr-12")}>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-white/55">
              <span>
                © {site.year} {site.name}
              </span>
              <FooterClock />
              {nav.footer.Legal.map((l) => (
                <Link key={l.label} href={l.href} className="transition-colors hover:text-white">
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-5">
              <p className="hidden text-[13px] text-white/55 md:block">Windows RDP &amp; VPS · USD · 30-day plans</p>
              <BackToTop />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
