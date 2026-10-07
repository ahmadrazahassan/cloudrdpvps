import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WindowsLogo } from "@/components/brand/windows-logo";
import { Faq } from "@/components/marketing/faq";
import { PageHero } from "@/components/marketing/page-hero";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { JsonLd } from "@/components/shared/json-ld";
import { PaymentLogo } from "@/components/shared/payment-logo";
import { CountryFlag, Eyebrow } from "@/components/shared/primitives";
import { Reveal } from "@/components/shared/reveal";
import { SiteImage } from "@/components/shared/site-image";
import { ButtonLink } from "@/components/ui/button";
import { getFaqsById } from "@/lib/faqs";
import { locationCopyFor, productPages } from "@/content/pages";
import { getCatalog, minPriceCents } from "@/lib/catalog";
import { faqLd, planProductsLd } from "@/lib/structured-data";
import { formatUsd } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

/** Built from the catalog, so a location the owner adds gets a page without a code change (rendered on first visit). */
export async function generateStaticParams() {
  const { locations } = await getCatalog();
  return locations.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { locations } = await getCatalog();
  const loc = locations.find((l) => l.slug === slug);
  if (!loc) return {};
  const title = `Windows RDP and VPS in ${loc.name}`;
  const description = `Windows RDP and Windows VPS servers in ${loc.name}. Simple 30-day plans in US dollars, with Windows Server and full administrator access included.`;
  return {
    title,
    description,
    alternates: { canonical: `/locations/${loc.slug}` },
    openGraph: { title, description, url: `/locations/${loc.slug}` },
  };
}

export default async function LocationPage({ params }: Props) {
  const { slug } = await params;
  const [catalog, faqItems] = await Promise.all([getCatalog(), getFaqsById(["delivery", "payments", "location", "connect"])]);
  const loc = catalog.locations.find((l) => l.slug === slug);
  if (!loc) notFound();

  const copy = locationCopyFor(loc.slug, loc.name);
  const rdp = minPriceCents(catalog, "rdp", loc.id);
  const vps = minPriceCents(catalog, "vps", loc.id);

  // Payment methods the owner has switched on for this country (or for everyone).
  const methods = catalog.paymentMethods.filter((m) => m.regions.length === 0 || m.regions.includes(loc.iso2));
  const others = catalog.locations.filter((l) => l.id !== loc.id);

  const blocks = [
    {
      product: "rdp" as const,
      from: rdp,
      body: `A ready-to-use Windows Server desktop hosted in ${loc.name}, with full administrator access. Connect from Windows, macOS, Android or iOS.`,
    },
    {
      product: "vps" as const,
      from: vps,
      body: `A Windows Server with dedicated resources hosted in ${loc.name}, with full administrator access, for hosting, automation and heavier workloads.`,
    },
  ];

  return (
    <>
      <JsonLd data={[...planProductsLd(catalog, { locationId: loc.id }), faqLd(faqItems)]} />

      <PageHero
        crumbs={[{ label: "Locations", href: "/locations" }, { label: loc.name }]}
        eyebrow={`LOCATION · ${loc.iso2}`}
        title={
          <>
            Windows servers in <span className="whitespace-nowrap">{loc.name}</span>.
          </>
        }
        lede={copy.summary}
        actions={
          <>
            <ButtonLink href="#plans" size="lg">
              View plans
            </ButtonLink>
            <ButtonLink href="/locations" variant="secondary" size="lg">
              All locations
            </ButtonLink>
          </>
        }
        art={
          loc.imageKey ? (
            <SiteImage name={loc.imageKey} priority className="w-full" sizes="(min-width: 1024px) 480px, 90vw" />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center">
              <CountryFlag iso2={loc.iso2} name={`Flag of ${loc.name}`} className="h-[150px] w-[225px] rounded-[6px] sm:h-[190px] sm:w-[285px]" />
            </div>
          )
        }
      />

      {/* Windows RDP / Windows VPS in {country} */}
      <section className="section-pad border-t border-line">
        <div className="container-site grid border-t border-line md:grid-cols-2 md:divide-x md:divide-line">
          {blocks.map((b, i) => {
            const p = productPages[b.product];
            return (
              <Reveal key={b.product} delay={i * 0.06} className={i === 0 ? "md:pr-10" : "md:pl-10"}>
                <article className="py-10">
                  <p className="label-caps">{p.label}</p>
                  <h2 className="mt-3 text-[26px] font-medium leading-tight tracking-[-0.02em] text-ink">
                    {p.label} in {loc.name}
                  </h2>
                  <p className="mt-4 max-w-[46ch] text-[16px] leading-[1.65] text-ink-2">{b.body}</p>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                    {b.from !== null ? (
                      <p className="num-tabular text-[14px] text-ink-2">
                        From <span className="text-lg font-medium text-ink">{formatUsd(b.from)}</span> / 30 days
                      </p>
                    ) : (
                      <p className="text-sm text-muted">Not available here right now</p>
                    )}
                    <Link href={p.path} className="label-caps text-lav-700 underline decoration-lav-300 underline-offset-4 hover:decoration-lav-700">
                      About {p.label}
                    </Link>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Plans, location fixed */}
      <section id="plans" className="section-pad border-t border-line">
        <div className="container-site">
          <Eyebrow>PLANS</Eyebrow>
          <h2 className="display-h2 mt-6 max-w-[20ch] text-balance">Plans in {loc.name}.</h2>
          <p className="mt-5 max-w-[58ch] text-[17px] leading-[1.65] text-ink-2">
            Every plan runs for <span className="whitespace-nowrap">30 days</span>, is priced in US dollars and includes
            Windows Server and full administrator access.
          </p>
          <div className="mt-12 space-y-20">
            {(["rdp", "vps"] as const)
              .filter((p) => catalog.plans.some((x) => x.product === p))
              .map((p, i) => (
                <div key={p} className={i > 0 ? "border-t border-line pt-16" : undefined}>
                  <h3 className="flex items-center justify-center gap-3 text-center font-display text-[26px] font-semibold tracking-[-0.02em] text-ink">
                    <WindowsLogo size={24} />
                    {productPages[p].label} in {loc.name}
                  </h3>
                  <div className="mt-10">
                    <PricingCards product={p} catalog={{ plans: catalog.plans, pricing: catalog.pricing }} location={{ id: loc.id, slug: loc.slug, name: loc.name }} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* Good for + payment */}
      <section className="section-pad border-t border-line">
        <div className="container-site grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <Eyebrow>WHY {loc.name.toUpperCase()}</Eyebrow>
            <h2 className="display-h2 mt-6 max-w-[16ch] text-balance">A good fit when…</h2>
            <ul className="mt-9 space-y-3.5">
              {copy.goodFor.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[16px] text-ink-2">
                  <Check size={18} strokeWidth={1.75} aria-hidden className="mt-1 shrink-0 text-lav-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Eyebrow>PAYING FROM {loc.name.toUpperCase()}</Eyebrow>
            <h2 className="display-h2 mt-6 max-w-[16ch] text-balance">How to pay.</h2>
            {methods.length > 0 ? (
              <>
                <p className="mt-5 max-w-[48ch] text-[17px] leading-[1.65] text-ink-2">
                  Payments are made manually, and our team verifies each one before your server is delivered. For{" "}
                  {loc.name} you can pay with:
                </p>
                <ul className="mt-6 border-t border-line">
                  {methods.map((m) => (
                    <li key={m.id} className="flex items-center gap-3.5 border-b border-line py-3.5 text-[16px] text-ink">
                      <span className="flex h-7 w-10 shrink-0 items-center justify-center">
                        <PaymentLogo name={m.name} type={m.type} className="max-w-full object-contain" />
                      </span>
                      {m.name}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-5 max-w-[48ch] text-[17px] leading-[1.65] text-ink-2">{copy.paymentNote}</p>
            )}
          </div>
        </div>
      </section>

      {/* Other locations — a handful here; the full searchable list is one click away */}
      <section className="section-pad border-t border-line">
        <div className="container-site">
          <Eyebrow>OTHER LOCATIONS</Eyebrow>
          <ul className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-t border-line pt-6">
            {others.slice(0, 12).map((l) => (
              <li key={l.id}>
                <Link
                  href={`/locations/${l.slug}`}
                  className="inline-flex items-center gap-2.5 text-[16px] font-medium text-ink transition-colors hover:text-lav-700"
                >
                  <CountryFlag iso2={l.iso2} />
                  {l.name}
                </Link>
              </li>
            ))}
            {others.length > 12 && (
              <li>
                <Link href="/locations" className="text-link text-[16px] font-medium">
                  All {catalog.locations.length} countries
                </Link>
              </li>
            )}
          </ul>
        </div>
      </section>

      <Faq items={faqItems} id="faq" title="Common questions." />
    </>
  );
}
