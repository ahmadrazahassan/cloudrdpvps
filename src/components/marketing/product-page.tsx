import { Check } from "lucide-react";
import Link from "next/link";
import { WindowsOs } from "@/components/brand/windows-logo";
import { Faq } from "@/components/marketing/faq";
import { PageHero } from "@/components/marketing/page-hero";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { SpecCompare } from "@/components/marketing/spec-compare";
import { JsonLd } from "@/components/shared/json-ld";
import { Eyebrow } from "@/components/shared/primitives";
import { Reveal } from "@/components/shared/reveal";
import { SiteImage } from "@/components/shared/site-image";
import { ButtonLink } from "@/components/ui/button";
import type { ProductType } from "@/content/catalog";
import { productPages } from "@/content/pages";
import { getCatalog, minPriceCents, specRanges } from "@/lib/catalog";
import { getFaqsById } from "@/lib/faqs";
import { faqLd, planProductsLd } from "@/lib/structured-data";
import { formatUsd, formatPort } from "@/lib/utils";

const range = (r: readonly [number, number], unit = "") =>
  r[0] === r[1] ? `${r[0]}${unit}` : `${r[0]}–${r[1]}${unit}`;

/** Shared body of /rdp and /vps. Copy comes from content/pages.ts; prices and specs from the live catalog. */
export async function ProductPage({ product }: { product: ProductType }) {
  const c = productPages[product];
  const catalog = await getCatalog();
  const from = minPriceCents(catalog, product);
  const s = specRanges(catalog, product);
  const faqItems = await getFaqsById(c.faqIds);

  return (
    <>
      <JsonLd data={[...planProductsLd(catalog, { product }), faqLd(faqItems)]} />

      <PageHero
        crumbs={[{ label: c.label }]}
        eyebrow={c.eyebrow}
        title={c.h1}
        lede={c.lede}
        actions={
          <>
            <ButtonLink href="#plans" size="lg">
              View plans
            </ButtonLink>
            <ButtonLink href="/locations" variant="secondary" size="lg">
              Compare locations
            </ButtonLink>
          </>
        }
        meta={
          from !== null ? (
            <p className="num-tabular flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-ink-2">
              <span>
                From <span className="text-lg font-medium text-ink">{formatUsd(from)}</span> / 30 days ·
              </span>
              <WindowsOs size={15} label="Windows Server included" />
            </p>
          ) : null
        }
        art={<SiteImage name={c.image} priority className="w-full" sizes="(min-width: 1024px) 440px, 80vw" />}
      />

      {/* Who it's for */}
      <section className="section-pad border-t border-line">
        <div className="container-site grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <div>
            <Eyebrow>USE CASES</Eyebrow>
            <h2 className="display-h2 mt-6 max-w-[14ch] text-balance">{c.audienceTitle}</h2>
          </div>
          <ul className="border-t border-line">
            {c.audience.map((a, i) => (
              <li key={a.title} className="border-b border-line">
                <Reveal delay={i * 0.05} className="flex items-start gap-5 py-6">
                  <a.icon size={24} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-lav-600" />
                  <div>
                    <h3 className="text-[18px] font-semibold text-ink">{a.title}</h3>
                    <p className="mt-1.5 max-w-[52ch] text-[15px] leading-relaxed text-muted">{a.body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="section-pad border-t border-line">
        <div className="container-site">
          <Eyebrow>PLANS</Eyebrow>
          <h2 className="display-h2 mt-6 max-w-[20ch] text-balance">Pick a plan.</h2>
          <p className="mt-5 max-w-[58ch] text-[17px] leading-[1.65] text-ink-2">
            Every {c.label} plan runs for <span className="whitespace-nowrap">30 days</span> and is priced in US
            dollars. Prices differ a little by country, so each shows its lowest — you choose the country when you order.
          </p>
          <div className="mt-12">
            <PricingCards product={product} catalog={{ plans: catalog.plans, pricing: catalog.pricing }} />
          </div>
          <p className="mt-6 text-sm text-muted">
            All plans run for 30 days. Renew any time before expiry to add another 30 days.
          </p>
        </div>
      </section>

      {/* What's included + range */}
      <section className="section-pad border-t border-line">
        <div className="container-site grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <Eyebrow>INCLUDED</Eyebrow>
            <h2 className="display-h2 mt-6 max-w-[14ch] text-balance">What&apos;s in every plan.</h2>
            <ul className="mt-9 space-y-3.5">
              {c.includes.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[16px] text-ink-2">
                  <Check size={18} strokeWidth={1.75} aria-hidden className="mt-1 shrink-0 text-lav-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label-caps border-b-2 border-lav-600 pb-4">{c.label} plan range</p>
            <dl>
              {[
                { k: "vCPU", v: range(s.vcpu) },
                { k: "RAM", v: range(s.ramGb, " GB") },
                { k: "NVMe storage", v: range(s.storageGb, " GB") },
                { k: "Bandwidth", v: range(s.bandwidthTb, " TB") },
                { k: "Port speed", v: `${formatPort(s.portMbps[0])} – ${formatPort(s.portMbps[1])}` },
                { k: "Operating system", v: <WindowsOs size={15} className="justify-end" /> },
                { k: "Plan length", v: "30 days" },
              ].map((r) => (
                <div key={r.k} className="flex items-center justify-between gap-4 border-b border-line py-4">
                  <dt className="label-caps">{r.k}</dt>
                  <dd className="num-tabular text-right text-[14px] font-medium text-ink">{r.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* RDP or VPS? */}
      <section className="section-pad border-t border-line">
        <div className="container-site">
          <Eyebrow>COMPARE</Eyebrow>
          <h2 className="display-h2 mt-6 max-w-[18ch] text-balance">Windows RDP or Windows VPS?</h2>
          <p className="mt-5 max-w-[58ch] text-[17px] leading-[1.65] text-ink-2">
            Both give you full administrator access to a Windows Server. The difference is how much room you get and
            what you plan to run.
          </p>
          <div className="mt-12">
            <SpecCompare catalog={catalog} current={product} />
          </div>
          <p className="mt-8 text-[15px] text-ink-2">
            Not sure which fits?{" "}
            <Link href="/contact" className="text-link">
              Ask our team
            </Link>{" "}
            and we&apos;ll point you to a plan.
          </p>
        </div>
      </section>

      <Faq items={faqItems} id="faq" title="Common questions." />
    </>
  );
}
