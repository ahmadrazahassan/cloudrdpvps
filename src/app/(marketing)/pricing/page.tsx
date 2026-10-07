import { Check } from "lucide-react";
import type { Metadata } from "next";
import { Faq } from "@/components/marketing/faq";
import { PageHero } from "@/components/marketing/page-hero";
import { Payments } from "@/components/marketing/payments";
import { PlansOverview } from "@/components/marketing/plans-overview";
import { SpecCompare } from "@/components/marketing/spec-compare";
import { JsonLd } from "@/components/shared/json-ld";
import { Eyebrow } from "@/components/shared/primitives";
import { getFaqsById } from "@/lib/faqs";
import { getCatalog } from "@/lib/catalog";
import { faqLd, planProductsLd } from "@/lib/structured-data";

const title = "Pricing — Windows RDP and VPS from flat 30-day plans";
const description =
  "Every Windows RDP and Windows VPS plan, in every location, priced in US dollars for 30 days. Windows Server and full administrator access are included.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/pricing" },
  openGraph: { title, description, url: "/pricing" },
};

const included = [
  "Windows Server, installed and ready to use",
  "Full administrator access",
  "An IPv4 address",
  "NVMe storage",
  "Setup and delivery by our team",
  "A 30-day term, with no automatic renewal",
];

export default async function PricingPage() {
  const [catalog, faqItems] = await Promise.all([getCatalog(), getFaqsById(["currency", "renewal", "payments", "unpaid"])]);

  return (
    <>
      <JsonLd data={[...planProductsLd(catalog), faqLd(faqItems)]} />

      <PageHero
        crumbs={[{ label: "Pricing" }]}
        eyebrow="PRICING"
        title={
          <>
            Straightforward <span className="whitespace-nowrap">30-day</span> pricing.
          </>
        }
        lede="Every Windows RDP and Windows VPS plan, in one place. Prices are in US dollars, every plan runs for 30 days, and Windows Server is included. You choose your country when you order."
        className="pb-10 md:pb-12"
      />

      <section className="pb-16 md:pb-24">
        <div className="container-site">
          <PlansOverview catalog={catalog} />
          <p className="mt-10 text-sm text-muted">
            All plans run for 30 days. Renew any time before expiry to add another 30 days.
          </p>
        </div>
      </section>

      <section className="section-pad border-t border-line">
        <div className="container-site grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <div>
            <Eyebrow>INCLUDED</Eyebrow>
            <h2 className="display-h2 mt-6 max-w-[14ch] text-balance">In every plan.</h2>
            <p className="mt-5 max-w-[40ch] text-[17px] leading-[1.65] text-ink-2">
              The same inclusions apply to every plan, product and location. Only the resources and the price change.
            </p>
          </div>
          <ul className="grid border-t border-line sm:grid-cols-2">
            {included.map((item, i) => (
              <li
                key={item}
                className={`flex items-start gap-3 border-b border-line py-5 text-[16px] text-ink-2 ${
                  i % 2 === 1 ? "sm:border-l sm:pl-6" : "sm:pr-6"
                }`}
              >
                <Check size={18} strokeWidth={1.75} aria-hidden className="mt-1 shrink-0 text-lav-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-pad border-t border-line">
        <div className="container-site">
          <Eyebrow>COMPARE</Eyebrow>
          <h2 className="display-h2 mt-6 max-w-[18ch] text-balance">Windows RDP or Windows VPS?</h2>
          <div className="mt-12">
            <SpecCompare catalog={catalog} />
          </div>
        </div>
      </section>

      <Payments />
      <Faq items={faqItems} id="faq" title="Billing questions." />
    </>
  );
}
