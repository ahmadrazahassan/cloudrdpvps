import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocument } from "@/components/marketing/legal-document";
import { getLegalDoc, legalDocs } from "@/content/legal";

type Props = { params: Promise<{ doc: string }> };

// Only the four documents exist; anything else under /legal is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return legalDocs.map((d) => ({ doc: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doc } = await params;
  const d = getLegalDoc(doc);
  if (!d) return {};
  return {
    title: d.title,
    description: d.summary,
    alternates: { canonical: `/legal/${d.slug}` },
    openGraph: { title: d.title, description: d.summary, url: `/legal/${d.slug}` },
  };
}

export default async function LegalPage({ params }: Props) {
  const { doc } = await params;
  const d = getLegalDoc(doc);
  if (!d) notFound();
  return <LegalDocument doc={d} />;
}
