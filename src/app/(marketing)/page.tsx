import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { Infrastructure } from "@/components/marketing/infrastructure";
import { Locations } from "@/components/marketing/locations";
import { Payments } from "@/components/marketing/payments";
import { Pricing } from "@/components/marketing/pricing";
import { Process } from "@/components/marketing/process";
import { Products } from "@/components/marketing/products";
import { UseCases } from "@/components/marketing/use-cases";
import { JsonLd } from "@/components/shared/json-ld";
import { getCatalog } from "@/lib/catalog";
import { getFaqContent } from "@/lib/faqs";
import { faqLd, organizationLd, planProductsLd, websiteLd } from "@/lib/structured-data";

export default async function HomePage() {
  const [catalog, { home: homeFaqs }] = await Promise.all([getCatalog(), getFaqContent()]);

  return (
    <>
      <JsonLd data={[organizationLd, websiteLd, faqLd(homeFaqs), ...planProductsLd(catalog)]} />
      <Hero />
      <Products />
      <Pricing />
      <Infrastructure />
      <Features />
      <Process />
      <Payments />
      <UseCases />
      <Locations />
      <Faq items={homeFaqs} />
    </>
  );
}
