import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { WindowsLogo } from "@/components/brand/windows-logo";
import { Eyebrow } from "@/components/shared/primitives";
import { SiteImage } from "@/components/shared/site-image";
import { ButtonLink } from "@/components/ui/button";
import { getCatalog, minPriceCents, placesPhrase } from "@/lib/catalog";
import { formatUsd } from "@/lib/utils";

const facts = [
  { label: "Windows only", windows: true },
  { label: "30-day plans", windows: false },
  { label: "Priced in USD", windows: false },
  { label: "Full admin access", windows: false },
];

/**
 * Homepage hero. Copy on the left, the server illustration on the right.
 *
 * From `lg` the 16:9 illustration is a backdrop pinned to the bottom-right of the
 * hero, always shown whole (never cropped). Its own background is the page
 * colour, so it has no visible edge, and the empty left third of the artwork
 * sits behind the copy. Sizes are chosen so the artwork's left-most line starts
 * to the right of the copy column at every width: 37vw tall on `lg`, 92% of the
 * hero's height from `xl`. Below `lg` the copy comes first and the artwork follows it.
 */
export async function Hero() {
  const catalog = await getCatalog();
  const locationCount = catalog.locations.length;

  const startingAt = [
    { label: "Windows RDP", href: "/rdp", cents: minPriceCents(catalog, "rdp") },
    { label: "Windows VPS", href: "/vps", cents: minPriceCents(catalog, "vps") },
  ].filter((p): p is typeof p & { cents: number } => p.cents !== null);

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div className="relative xl:h-[clamp(600px,46vw,760px)]">
        {/* Copy */}
        <div className="container-site relative z-10 flex pb-4 pt-10 md:pt-14 lg:pb-12 xl:h-full xl:items-center xl:py-0">
          <div className="w-full max-w-[600px] lg:max-w-[480px] xl:max-w-[540px]">
            <Eyebrow>
              Windows RDP &amp; VPS · {locationCount} {locationCount === 1 ? "location" : "locations"}
            </Eyebrow>
            <h1
              id="hero-title"
              className="display-xl mt-7 text-[clamp(42px,7vw,72px)] text-balance lg:text-[clamp(52px,5.6vw,64px)] xl:text-[clamp(56px,5.4vw,78px)]"
            >
              Windows RDP and VPS, <span className="text-lav-600">ready when you are.</span>
            </h1>
            <p className="mt-6 max-w-[46ch] text-pretty text-[17px] leading-[1.65] text-ink-2 md:text-lg">
              Dedicated Windows servers in {placesPhrase(catalog.locations)}. Simple{" "}
              <span className="whitespace-nowrap">30-day</span> plans, flat dollar pricing, and every server set up by
              our team.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ButtonLink href="/#pricing" size="lg">
                View plans
                <ArrowRight size={16} strokeWidth={2} aria-hidden />
              </ButtonLink>
              <ButtonLink href="/#locations" variant="secondary" size="lg">
                Compare locations
              </ButtonLink>
            </div>

            {startingAt.length > 0 && (
              <dl className="mt-10 flex w-fit flex-wrap gap-x-10 gap-y-5 border-t border-line pt-6">
                {startingAt.map((p) => (
                  <div key={p.href}>
                    <dt className="label-caps inline-flex items-center gap-2">
                      <WindowsLogo size={14} />
                      {p.label}
                    </dt>
                    <dd className="mt-1.5">
                      <Link
                        href={p.href}
                        className="font-display text-[22px] font-semibold leading-none tracking-[-0.02em] text-ink num-tabular underline-offset-[6px] hover:underline"
                      >
                        <span className="mr-1.5 text-[13px] font-medium tracking-normal text-muted">
                          from
                        </span>
                        {formatUsd(p.cents)}
                        <span className="ml-1.5 text-[13px] font-medium tracking-normal text-muted">
                          / 30 days
                        </span>
                      </Link>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>

        {/* Artwork */}
        <div
          aria-hidden
          className="relative ml-auto mt-2 aspect-[4/3] w-full max-w-[900px] sm:aspect-[16/10] md:aspect-[16/9] lg:absolute lg:bottom-0 lg:right-0 lg:mt-0 lg:h-[37vw] lg:w-auto lg:max-w-none xl:h-[92%]"
        >
          <SiteImage
            name="hero-section"
            preload
            sizes="(min-width: 1280px) min(76vw, 1243px), (min-width: 1024px) 66vw, (min-width: 900px) 900px, 100vw"
            className="h-full w-full object-cover object-right"
          />

          {/* Illustrative status note: plain type + a hairline, no box. */}
          <div className="absolute left-[77%] top-[9%] hidden border-l border-line-2 pl-4 lg:block">
            <p className="data-id text-[12px] font-medium text-ink">WIN-SRV-0142</p>
            <p className="mt-2 flex items-center gap-2 text-[13px] font-medium text-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              Online
            </p>
            <p className="label-caps mt-1 normal-case tracking-normal">Expires in 27 days</p>
          </div>
        </div>
      </div>

      <ul className="container-site relative z-10 mt-2 grid grid-cols-2 border-y border-line sm:grid-cols-4 lg:mt-0">
        {facts.map((f, i) => (
          <li
            key={f.label}
            className={`label-caps px-4 py-4 text-center ${
              i > 0 ? "sm:border-l sm:border-line" : ""
            } ${i % 2 === 1 ? "border-l border-line sm:border-l" : ""} ${
              i > 1 ? "border-t border-line sm:border-t-0" : ""
            }`}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {f.windows && <WindowsLogo size={14} />}
              {f.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
