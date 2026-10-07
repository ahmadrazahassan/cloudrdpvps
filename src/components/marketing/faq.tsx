import Link from "next/link";
import { Eyebrow } from "@/components/shared/primitives";
import { homeFaqs, type Faq } from "@/content/faqs";
import { FaqAccordion } from "./faq-accordion";

/**
 * Two-column FAQ block. The homepage shows the featured questions; product and
 * location pages pass their own short list and link on to the full /faq page.
 */
export function Faq({
  items = homeFaqs,
  id = "faq",
  title = "Questions, answered.",
}: {
  items?: Faq[];
  id?: string;
  title?: string;
}) {
  return (
    <section id={id} className="section-pad border-t border-line">
      <div className="container-site grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="display-h2 mt-6 max-w-[12ch] text-balance">{title}</h2>
          <p className="mt-5 max-w-[34ch] text-[15px] leading-relaxed text-muted">
            Still stuck?{" "}
            <Link
              href="/contact"
              className="font-medium text-lav-700 underline underline-offset-4 hover:text-lav-800"
            >
              Contact us
            </Link>{" "}
            and our team will help, or{" "}
            <Link
              href="/faq"
              className="font-medium text-lav-700 underline underline-offset-4 hover:text-lav-800"
            >
              read every answer
            </Link>
            .
          </p>
        </div>
        <FaqAccordion items={items} />
      </div>
    </section>
  );
}
