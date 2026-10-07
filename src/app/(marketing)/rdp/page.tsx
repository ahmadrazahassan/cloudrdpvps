import type { Metadata } from "next";
import { ProductPage } from "@/components/marketing/product-page";
import { productPages } from "@/content/pages";

const c = productPages.rdp;

export const metadata: Metadata = {
  title: c.metaTitle,
  description: c.metaDescription,
  alternates: { canonical: c.path },
  openGraph: { title: c.metaTitle, description: c.metaDescription, url: c.path },
};

export default function RdpPage() {
  return <ProductPage product="rdp" />;
}
