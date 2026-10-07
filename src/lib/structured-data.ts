import type { Faq } from "@/content/faqs";
import { site } from "@/content/site";
import type { Catalog, ProductType } from "@/lib/catalog";
import { plainText } from "@/lib/faqs-map";

/** schema.org builders shared by the homepage, product, location and FAQ pages. */

export const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  url: site.url,
  description: site.description,
  logo: `${site.url}/brand/logo.png`,
};

export const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: site.name,
  url: site.url,
};

export function faqLd(items: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: plainText(f.answer) },
    })),
  };
}

/**
 * One Product per plan with an AggregateOffer across its in-stock locations.
 * Optionally limited to one product line and/or one location.
 */
export function planProductsLd(catalog: Catalog, opts: { product?: ProductType; locationId?: string } = {}) {
  return catalog.plans
    .filter((plan) => !opts.product || plan.product === opts.product)
    .flatMap((plan) => {
      const prices = catalog.pricing
        .filter(
          (p) =>
            p.planId === plan.id &&
            p.stock !== "out_of_stock" &&
            (!opts.locationId || p.locationId === opts.locationId),
        )
        .map((p) => p.priceCents / 100);
      if (prices.length === 0) return [];
      return [
        {
          "@context": "https://schema.org",
          "@type": "Product",
          name: `${plan.name} — Windows ${plan.product.toUpperCase()}`,
          description: `${plan.vcpu} vCPU, ${plan.ramGb} GB RAM, ${plan.storageGb} GB NVMe, ${plan.bandwidthTb} TB bandwidth. Windows Server included. 30-day plan.`,
          brand: { "@type": "Brand", name: site.name },
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "USD",
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            offerCount: prices.length,
          },
        },
      ];
    });
}
