import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/page-hero";
import { legalDocs, legalUpdated, legalUpdatedIso } from "@/content/legal";

const title = "Legal — terms, privacy, acceptable use and refunds";
const description = "The Terms of Service, Privacy Policy, Acceptable Use Policy and Refund Policy for Cloud RDP VPS.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/legal" },
  openGraph: { title, description, url: "/legal" },
};

export default function LegalIndexPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Legal" }]}
        eyebrow="LEGAL"
        title="The fine print, in plain language."
        lede="Everything that governs your account, your server and your payments."
        meta={
          <p className="label-caps">
            Last updated <time dateTime={legalUpdatedIso}>{legalUpdated}</time>
          </p>
        }
        className="pb-10 md:pb-14"
      />

      <section className="pb-24">
        <div className="container-site">
          <ul className="border-t border-line">
            {legalDocs.map((d) => (
              <li key={d.slug} className="border-b border-line">
                <Link
                  href={`/legal/${d.slug}`}
                  className="group flex items-center justify-between gap-6 py-7 transition-colors hover:text-lav-700"
                >
                  <span>
                    <span className="block text-[22px] font-semibold tracking-[-0.016em] text-ink group-hover:text-lav-700">
                      {d.title}
                    </span>
                    <span className="mt-1.5 block max-w-[60ch] text-[15px] leading-relaxed text-muted">{d.summary}</span>
                  </span>
                  <ArrowRight size={20} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted group-hover:text-lav-700" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
