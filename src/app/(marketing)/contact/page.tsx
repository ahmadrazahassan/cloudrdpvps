import { LifeBuoy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { ContactForm } from "@/components/marketing/contact-form";
import { Eyebrow } from "@/components/shared/primitives";
import { getSiteSettings } from "@/lib/site-settings";

const title = "Contact — talk to the Cloud RDP VPS team";
const description =
  "Questions before you order, help with a payment or a server, or an abuse report — send us a message and our team will reply by email.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/contact" },
  openGraph: { title, description, url: "/contact" },
};

export default async function ContactPage() {
  const site = await getSiteSettings();
  const channels = [
    site.supportEmail && { label: "Email", value: site.supportEmail, href: `mailto:${site.supportEmail}` },
    site.telegram && { label: "Telegram", value: "Message us on Telegram", href: site.telegram },
    site.whatsapp && { label: "WhatsApp", value: "Message us on WhatsApp", href: site.whatsapp },
  ].filter(Boolean) as { label: string; value: string; href: string }[];

  return (
    <section className="pt-8 pb-20 md:pt-10 md:pb-28">
      <div className="container-site">
        <Breadcrumbs items={[{ label: "Contact" }]} />

        <div className="mt-10 grid gap-14 md:mt-14 lg:grid-cols-[1fr_1.15fr] lg:gap-24">
          <div>
            <Eyebrow line={false}>CONTACT</Eyebrow>
            <h1 className="display-h1 mt-6 max-w-[14ch]">Talk to a person.</h1>
            <p className="mt-6 max-w-[44ch] text-[17px] leading-[1.65] text-ink-2 md:text-lg">
              Questions before you order, help with a payment or a server, or something we should know about. Send a
              message and our team will reply by email.
            </p>

            <div className="mt-12 border-t border-line">
              {channels.length > 0 && (
                <dl>
                  {channels.map((c) => (
                    <div
                      key={c.label}
                      className="grid gap-1 border-b border-line py-4 sm:grid-cols-[120px_1fr] sm:gap-6"
                    >
                      <dt className="label-caps">{c.label}</dt>
                      <dd className="text-[15px] font-medium">
                        <a href={c.href} className="text-link">
                          {c.value}
                        </a>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="flex items-start gap-4 border-b border-line py-5">
                <LifeBuoy size={22} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-lav-600" />
                <p className="text-[15px] leading-relaxed text-ink-2">
                  <span className="font-semibold text-ink">Already a customer?</span> Open a ticket from your{" "}
                  <Link href="/dashboard" className="text-link">
                    dashboard
                  </Link>{" "}
                  so we can see your order and server straight away.
                </p>
              </div>
              <div className="border-b border-line py-5">
                <p className="text-[15px] leading-relaxed text-ink-2">
                  <span className="font-semibold text-ink">Reporting abuse?</span> Choose “Report abuse” and include the
                  IP address. See our{" "}
                  <Link href="/legal/acceptable-use" className="text-link">
                    Acceptable Use Policy
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>

          <div>
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}
