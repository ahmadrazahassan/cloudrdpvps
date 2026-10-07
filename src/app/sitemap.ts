import type { MetadataRoute } from "next";
import { legalDocs, legalUpdatedIso } from "@/content/legal";
import { site } from "@/content/site";
import { getCatalog } from "@/lib/catalog";

/** Only real, indexable pages. Locations come from the catalog, so a new one appears here automatically. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { locations } = await getCatalog();
  const now = new Date();
  const legalDate = new Date(legalUpdatedIso);
  const url = (p: string) => `${site.url}${p}`;

  return [
    { url: site.url, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: url("/rdp"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: url("/vps"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: url("/pricing"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: url("/locations"), lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    ...locations.map((l) => ({
      url: url(`/locations/${l.slug}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    { url: url("/features"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: url("/faq"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: url("/about"), lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: url("/contact"), lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: url("/legal"), lastModified: legalDate, changeFrequency: "yearly", priority: 0.3 },
    ...legalDocs.map((d) => ({
      url: url(`/legal/${d.slug}`),
      lastModified: legalDate,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
