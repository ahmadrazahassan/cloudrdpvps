import { X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/page-hero";
import { CountryFlag, Eyebrow } from "@/components/shared/primitives";
import { Reveal } from "@/components/shared/reveal";
import { ButtonLink } from "@/components/ui/button";
import { aboutPrinciples, aboutWontDo } from "@/content/pages";
import { getCatalog, placesPhrase } from "@/lib/catalog";

const title = "About — Windows RDP and VPS, delivered by people";
const description =
  "Cloud RDP VPS sells Windows RDP and Windows VPS in countries around the world on simple 30-day plans. Learn how we work and what we promise.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/about" },
  openGraph: { title, description, url: "/about" },
};

export default async function AboutPage() {
  const catalog = await getCatalog();

  return (
    <>
      <PageHero
        crumbs={[{ label: "About" }]}
        eyebrow="ABOUT"
        title="Windows servers, set up by people."
        lede="Cloud RDP VPS sells Windows RDP and Windows VPS servers. We keep the offer small on purpose, and we do the setup by hand."
        actions={
          <>
            <ButtonLink href="/pricing" size="lg">
              View pricing
            </ButtonLink>
            <ButtonLink href="/contact" variant="secondary" size="lg">
              Contact us
            </ButtonLink>
          </>
        }
        className="pb-12 md:pb-16"
      />

      <section className="section-pad border-t border-line">
        <div className="container-site grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <div>
            <Eyebrow>WHAT WE DO</Eyebrow>
            <h2 className="display-h2 mt-6 max-w-[14ch] text-balance">A focused offer.</h2>
          </div>
          <div className="max-w-[60ch] space-y-5 text-[17px] leading-[1.7] text-ink-2">
            <p>
              We provide Windows RDP and Windows VPS servers in {placesPhrase(catalog.locations)}. Every
              server runs Windows Server, every plan lasts 30 days, and every price is in US dollars.
            </p>
            <p>
              Payments are made manually with the methods available in your region. Once we have verified your payment,
              our team sets up your server and delivers the login details to your dashboard. It is a deliberately
              personal process, and it is why support is never far away.
            </p>
            <p>
              We would rather do a smaller set of things carefully than promise everything. The rest of this page
              explains how we think about it.
            </p>
          </div>
        </div>
      </section>

      <section className="section-pad border-t border-line">
        <div className="container-site">
          <Eyebrow>HOW WE WORK</Eyebrow>
          <h2 className="display-h2 mt-6 max-w-[18ch] text-balance">Four principles.</h2>
          <div className="ruled-wrap mt-12">
            <ol className="ruled grid md:grid-cols-2">
              {aboutPrinciples.map((p, i) => (
                <li key={p.title} className="px-0 py-8 md:px-8 md:py-10">
                  <Reveal delay={(i % 2) * 0.06}>
                    <p className="label-caps">0{i + 1}</p>
                    <h3 className="mt-4 text-[21px] font-semibold tracking-[-0.015em] text-ink">{p.title}</h3>
                    <p className="mt-3 max-w-[44ch] text-[15px] leading-[1.7] text-muted">{p.body}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="section-pad border-t border-line">
        <div className="container-site grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <div>
            <Eyebrow>OUR LIMITS</Eyebrow>
            <h2 className="display-h2 mt-6 max-w-[14ch] text-balance">What we won&apos;t do.</h2>
          </div>
          <ul className="border-t border-line">
            {aboutWontDo.map((item) => (
              <li key={item} className="flex items-start gap-4 border-b border-line py-5 text-[16px] text-ink">
                <X size={18} strokeWidth={1.75} aria-hidden className="mt-1 shrink-0 text-muted" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-pad border-t border-line">
        <div className="container-site">
          <Eyebrow>WHERE</Eyebrow>
          <h2 className="display-h2 mt-6 max-w-[18ch] text-balance">Where our servers are.</h2>
          <ul className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-line pt-6">
            {catalog.locations.map((l) => (
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
          </ul>
        </div>
      </section>

    </>
  );
}
