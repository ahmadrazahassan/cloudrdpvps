import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { WindowsLogo } from "@/components/brand/windows-logo";
import { CountryFlag } from "@/components/shared/primitives";
import type { Catalog, Location, ProductType } from "@/lib/catalog";
import { directoryItems } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { CountryExplorer } from "./country-explorer";
import { PricingCards } from "./pricing-cards";

const PRODUCTS: { id: ProductType; label: string; blurb: string; href: string; short: string }[] = [
  {
    id: "rdp",
    label: "Windows RDP",
    blurb: "A ready-to-use Windows desktop you connect to from anywhere.",
    href: "/rdp",
    short: "RDP",
  },
  {
    id: "vps",
    label: "Windows VPS",
    blurb: "A Windows server with full administrator access for heavier workloads.",
    href: "/vps",
    short: "VPS",
  },
];

/**
 * Every plan of both products, one product after the other — no tabs, no country picker. Each product's plans are pricing cards
 * (see PricingCards): prices show as "from" the lowest price anywhere, because the country is chosen on the order screen.
 * Under them, a searchable list of every country with its starting prices.
 */
export function PlansOverview({ catalog }: { catalog: Catalog }) {
  const slice = { plans: catalog.plans, pricing: catalog.pricing };
  const blocks = PRODUCTS.filter((p) => catalog.plans.some((x) => x.product === p.id));
  return (
    <div>
      <CountryNote locations={catalog.locations} />

      <div className="mt-14 space-y-20 md:space-y-24">
        {blocks.map((p, i) => (
          <section key={p.id} id={`${p.id}-plans`} aria-labelledby={`${p.id}-plans-title`} className={cn("scroll-mt-24", i > 0 && "border-t border-line pt-16 md:pt-20")}>
            <div className="text-center">
              <h3 id={`${p.id}-plans-title`} className="inline-flex items-center justify-center gap-3 font-display text-[28px] font-semibold tracking-[-0.022em] text-ink md:text-[32px]">
                <WindowsLogo size={28} />
                {p.label}
              </h3>
              <p className="mx-auto mt-3 max-w-[56ch] text-[16px] leading-relaxed text-ink-2">{p.blurb}</p>
              <p className="mt-3 text-[14px]">
                <Link href={p.href} className="text-link">
                  About {p.label}
                </Link>
              </p>
            </div>
            <div className="mt-10">
              <PricingCards product={p.id} catalog={slice} />
            </div>
          </section>
        ))}
      </div>

      {catalog.locations.length > 1 && (
        <details className="group mt-20 border-y border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between py-5 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
            Prices by country
            <ChevronDown size={18} strokeWidth={1.5} aria-hidden className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-line py-8">
            <p className="mx-auto mb-8 max-w-[60ch] text-center text-[14px] leading-relaxed text-muted">The lowest price for each product in each country, per 30 days. Open a country to see every plan there.</p>
            <CountryExplorer items={directoryItems(catalog)} prices />
          </div>
        </details>
      )}
    </div>
  );
}

/** Which countries we serve — information, not a control. A handful by name, the rest by count. */
function CountryNote({ locations }: { locations: Location[] }) {
  if (locations.length === 0) return null;
  const shown = locations.slice(0, 5);
  const more = locations.length - shown.length;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-y border-line py-4 text-center text-[14px]">
      <span className="text-ink-2">{locations.length > 1 ? `Servers in ${locations.length} countries. You choose when you order:` : "Choose your country when you order:"}</span>
      <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {shown.map((l) => (
          <li key={l.id} className="inline-flex items-center gap-2 font-medium text-ink">
            <CountryFlag iso2={l.iso2} />
            {l.name}
          </li>
        ))}
        {more > 0 && (
          <li>
            <Link href="/locations" className="text-link font-medium">
              and {more} more
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}
