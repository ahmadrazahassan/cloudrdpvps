import Link from "next/link";
import { CountryFlag } from "@/components/shared/primitives";
import { Reveal } from "@/components/shared/reveal";
import { ButtonLink } from "@/components/ui/button";
import { worldCountry } from "@/content/world";
import { getCatalog } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { GlobeArt } from "./globe-art";

/**
 * Where the first few country chips sit around the globe (large screens only), as percentages of the globe's box.
 * Each drifts up and down on its own slow beat. On smaller screens the same countries are a plain row of chips below.
 */
const SLOTS = [
  { left: "-4%", top: "10%", delay: "0s" },
  { right: "-2%", top: "6%", delay: "-2s" },
  { left: "-17%", top: "38%", delay: "-4s" },
  { right: "-16%", top: "36%", delay: "-1s" },
  { left: "-6%", top: "68%", delay: "-3s" },
  { right: "-4%", top: "70%", delay: "-5s" },
  { left: "24%", top: "93%", delay: "-2.5s" },
  { right: "26%", top: "-3%", delay: "-4.5s" },
] as const;

/**
 * Homepage, just above the FAQ: the globe, big and turning, with some of the countries around it, the numbers that matter, and the
 * way to the full list. Deliberately short — every country (grouped, searchable, with prices) lives on /locations. Centred.
 */
export async function Locations() {
  const catalog = await getCatalog();
  const count = catalog.locations.length;
  const named = catalog.locations.slice(0, SLOTS.length);
  const regions = new Set(catalog.locations.map((l) => worldCountry(l.iso2)?.region).filter(Boolean)).size;

  const stats = [
    { n: String(count), label: count === 1 ? "country" : "countries" },
    { n: String(regions || 1), label: regions === 1 ? "region" : "regions" },
    { n: "2", label: "products: RDP & VPS" },
    { n: "30", label: "days per plan" },
  ];

  return (
    <section id="locations" className="section-pad overflow-x-clip border-t border-line">
      <div className="container-site text-center">
        <p className="label-caps">LOCATIONS</p>
        <h2 className="display-h2 mx-auto mt-6 max-w-[20ch] text-balance">{count > 1 ? `Servers in ${count} countries.` : "Servers where you need them."}</h2>
        <p className="mx-auto mt-5 max-w-[58ch] text-[17px] leading-[1.65] text-ink-2">
          Pick the country closest to your workflow. Every location offers Windows RDP and Windows VPS on the same simple{" "}
          <span className="whitespace-nowrap">30-day</span> plans.
        </p>

        {/* the globe, with some countries drifting around it */}
        <Reveal className="relative mx-auto mt-12 w-full max-w-[460px] sm:max-w-[560px] lg:max-w-[640px]">
          <GlobeArt />
          <ul aria-label="Some of our locations" className="hidden lg:block">
            {named.map((l, i) => {
              const slot = SLOTS[i]!;
              return (
                <li key={l.id} className="absolute" style={{ left: "left" in slot ? slot.left : undefined, right: "right" in slot ? slot.right : undefined, top: slot.top }}>
                  <Link
                    href={`/locations/${l.slug}`}
                    style={{ animationDelay: slot.delay }}
                    className="inline-flex animate-[chip-float_6s_ease-in-out_infinite_alternate] items-center gap-2.5 whitespace-nowrap rounded-full bg-white px-4 py-2.5 text-[14px] font-medium text-ink shadow-[0_10px_28px_-14px_rgb(18_18_20/0.35)] transition-shadow hover:shadow-[0_14px_32px_-12px_rgb(18_18_20/0.45)]"
                  >
                    <CountryFlag iso2={l.iso2} className="h-[16px] w-[24px]" />
                    {l.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Reveal>

        <ul aria-label="Some of our locations" className="mx-auto mt-8 flex max-w-[640px] flex-wrap justify-center gap-2.5 lg:hidden">
          {named.map((l) => (
            <li key={l.id}>
              <Link href={`/locations/${l.slug}`} className="inline-flex items-center gap-2.5 rounded-full bg-white px-3.5 py-2 text-[13.5px] font-medium text-ink shadow-[0_1px_2px_rgb(18_18_20/0.06)]">
                <CountryFlag iso2={l.iso2} className="h-[15px] w-[22px]" />
                {l.name}
              </Link>
            </li>
          ))}
        </ul>

        <dl className="mx-auto mt-14 grid max-w-[860px] grid-cols-2 gap-y-8 sm:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className={cn("px-4", i > 0 && "sm:border-l sm:border-line", i % 2 === 1 && "max-sm:border-l max-sm:border-line")}>
              <dd className="num-tabular font-display text-[44px] font-medium leading-none tracking-[-0.035em] text-ink">{s.n}</dd>
              <dt className="mt-2 text-[13px] text-muted">{s.label}</dt>
            </div>
          ))}
        </dl>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/order/new" size="lg">
            Choose your country
          </ButtonLink>
          <ButtonLink href="/locations" variant="secondary" size="lg">
            {count > SLOTS.length ? `See all ${count} countries` : "See all locations"}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
