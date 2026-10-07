import { Check } from "lucide-react";
import { WindowsLogo } from "@/components/brand/windows-logo";
import { Reveal } from "@/components/shared/reveal";
import { Eyebrow } from "@/components/shared/primitives";
import { SiteImage } from "@/components/shared/site-image";
import { ButtonLink } from "@/components/ui/button";
import { getCatalog, minPriceCents } from "@/lib/catalog";
import { formatUsd } from "@/lib/utils";
import type { ImageKey } from "@/content/images";

const products = [
  {
    key: "rdp" as const,
    image: "product-rdp" as ImageKey,
    label: "Windows RDP",
    title: "A Windows desktop you connect to from anywhere.",
    body: "A ready-to-use Windows desktop. Ideal for trading platforms, remote work and everyday Windows apps.",
    bullets: [
      "Ready-to-use Windows desktop",
      "Connect from Windows, macOS, Android or iOS",
      "Full administrator access",
    ],
    href: "/rdp",
  },
  {
    key: "vps" as const,
    image: "product-vps" as ImageKey,
    label: "Windows VPS",
    title: "A Windows server you fully control.",
    body: "A Windows server with full administrator access for hosting, automation and heavier workloads.",
    bullets: [
      "Higher-spec plans for heavier workloads",
      "Full administrator access",
      "Install and run your own software",
    ],
    href: "/vps",
  },
];

export async function Products() {
  const catalog = await getCatalog();
  return (
    <section id="products" className="section-pad">
      <div className="container-site">
        <Eyebrow>PRODUCTS</Eyebrow>
        <h2 className="display-h2 mt-6 max-w-[20ch] text-balance">
          Choose your product.
        </h2>

        {/* Two open columns split by a single hairline — no boxes. */}
        <div className="mt-12 grid border-t border-line md:grid-cols-2 md:divide-x md:divide-line">
          {products.map((p, i) => {
            const from = minPriceCents(catalog, p.key);
            return (
              <Reveal key={p.key} delay={i * 0.08} className={i === 0 ? "md:pr-10" : "md:pl-10"}>
                <article className="flex h-full flex-col py-10 md:py-12">
                  <div className="flex h-[300px] items-center justify-center">
                    <SiteImage
                      name={p.image}
                      className="h-full w-auto max-w-full"
                      sizes="(min-width: 768px) 420px, 90vw"
                    />
                  </div>
                  <div className="mt-8 flex flex-1 flex-col">
                    <p className="label-caps inline-flex items-center gap-2.5">
                      <WindowsLogo size={16} />
                      {p.label}
                    </p>
                    <h3 className="mt-3 text-[22px] font-semibold leading-snug tracking-[-0.015em] text-ink">
                      {p.title}
                    </h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
                      {p.body}
                    </p>
                    <ul className="mt-5 space-y-2.5">
                      {p.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2.5 text-[15px] text-ink-2">
                          <Check
                            size={18}
                            strokeWidth={1.75}
                            aria-hidden
                            className="mt-0.5 shrink-0 text-lav-600"
                          />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-8">
                      {from !== null ? (
                        <p className="num-tabular text-[13px] text-ink-2">
                          From{" "}
                          <span className="text-lg font-medium text-ink">
                            {formatUsd(from)}
                          </span>{" "}
                          / 30 days
                        </p>
                      ) : (
                        <span />
                      )}
                      <div className="flex gap-2">
                        <ButtonLink href={`/#${p.key}-plans`} size="md">
                          See plans
                        </ButtonLink>
                        <ButtonLink href={p.href} variant="secondary" size="md">
                          Learn more
                        </ButtonLink>
                      </div>
                    </div>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
