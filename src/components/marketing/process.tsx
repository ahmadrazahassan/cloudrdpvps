import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { Eyebrow } from "@/components/shared/primitives";
import { SiteImage } from "@/components/shared/site-image";
import type { ImageKey } from "@/content/images";
import { getSiteSettings } from "@/lib/site-settings";

const steps: { image: ImageKey; title: string; body: string }[] = [
  {
    image: "step-1",
    title: "Choose",
    body: "Pick a plan and a location that fits your workload.",
  },
  {
    image: "step-2",
    title: "Order",
    body: "Place your order and get clear payment instructions.",
  },
  {
    image: "step-3",
    title: "Pay & upload proof",
    body: "Pay with your preferred method and upload your receipt.",
  },
  {
    image: "step-4",
    title: "We deliver",
    body: "Credentials appear in your dashboard after we verify your payment.",
  },
];

export async function Process() {
  const site = await getSiteSettings();
  return (
    <section id="process" className="section-pad border-t border-line">
      <div className="container-site">
        <Eyebrow>PROCESS</Eyebrow>
        <h2 className="display-h2 mt-6 max-w-[18ch] text-balance">
          From order to login in four steps.
        </h2>

        <ol className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="relative">
              <Reveal delay={i * 0.07}>
                <p className="label-caps">Step 0{i + 1}</p>
                <div className="mt-6 h-[136px] w-[136px]">
                  <SiteImage name={s.image} className="h-full w-full" sizes="136px" />
                </div>
                <h3 className="mt-6 text-[19px] font-semibold tracking-[-0.01em] text-ink">
                  {s.title}
                </h3>
                <p className="mt-2 max-w-[28ch] text-[15px] leading-relaxed text-muted">
                  {s.body}
                </p>
              </Reveal>
              {i < steps.length - 1 && (
                <ArrowRight
                  aria-hidden
                  size={20}
                  strokeWidth={1.5}
                  className="absolute -right-6 top-[96px] hidden text-line-2 lg:block"
                />
              )}
            </li>
          ))}
        </ol>

        {site.deliveryEta && (
          <p className="mt-12 border-t border-line pt-6 text-sm text-ink-2">
            <span className="label-caps mr-3">Typical delivery</span>
            {site.deliveryEta}
          </p>
        )}
      </div>
    </section>
  );
}
