import type { Metadata } from "next";
import { Suspense } from "react";
import { FaqBrowser } from "@/components/marketing/faq-browser";
import { PageHero } from "@/components/marketing/page-hero";
import { JsonLd } from "@/components/shared/json-ld";
import { SiteImage } from "@/components/shared/site-image";
import { getFaqContent } from "@/lib/faqs";
import { faqLd } from "@/lib/structured-data";

const title = "FAQ — questions about Windows RDP and VPS, answered";
const description =
  "Answers about ordering, delivery, manual payment, the 30-day term, connecting to your server, refunds and acceptable use.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/faq" },
  openGraph: { title, description, url: "/faq" },
};

export default async function FaqPage() {
  const { faqs, categories: faqCategories } = await getFaqContent();
  return (
    <>
      <JsonLd data={faqLd(faqs)} />

      <PageHero
        crumbs={[{ label: "FAQ" }]}
        eyebrow="FAQ"
        title="Questions, answered."
        lede="How ordering, payment and delivery work, how to connect, and what our policies say. Can't find it? Contact us and we'll help."
        className="pb-10 md:pb-12"
      />

      <section className="pb-20 md:pb-28">
        <div className="container-site">
          <Suspense fallback={<div aria-hidden className="skeleton h-[420px]" />}>
            <FaqBrowser
              items={faqs}
              categories={faqCategories}
              emptyArt={<SiteImage name="empty-search" className="h-full w-full" sizes="180px" />}
            />
          </Suspense>
        </div>
      </section>

    </>
  );
}
