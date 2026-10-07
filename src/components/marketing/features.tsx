import { Reveal } from "@/components/shared/reveal";
import { Eyebrow } from "@/components/shared/primitives";
import { SiteImage } from "@/components/shared/site-image";
import type { ImageKey } from "@/content/images";

const features: { n: string; image: ImageKey; title: string; body: string }[] = [
  {
    n: "001",
    image: "feat-admin",
    title: "Full administrator access",
    body: "Log in with the credentials we deliver and manage your Windows environment yourself.",
  },
  {
    n: "002",
    image: "feat-nvme",
    title: "NVMe-backed storage",
    body: "Fast disks across every plan for responsive desktops and applications.",
  },
  {
    n: "003",
    image: "feat-locations",
    title: "Five locations",
    body: "Pick the country closest to your workflow and keep latency low.",
  },
  {
    n: "004",
    image: "feat-support",
    title: "Hands-on delivery",
    body: "Every order is verified and set up by our team, with support one ticket away.",
  },
];

export function Features() {
  return (
    <section id="features" className="section-pad border-t border-line">
      <div className="container-site">
        <Eyebrow>FEATURES</Eyebrow>
        <h2 className="display-h2 mt-6 max-w-[20ch] text-balance">
          Everything you need, nothing you don&apos;t.
        </h2>

        <ul className="mt-14 grid border-t border-line sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <li
              key={f.n}
              className={`border-b border-line px-0 py-8 sm:px-6 lg:border-b-0 lg:py-10 ${
                i % 2 === 1 ? "sm:border-l" : ""
              } ${i > 0 ? "lg:border-l" : "lg:pl-0"} ${i === 2 ? "sm:border-l-0 lg:border-l" : ""} ${
                i === 3 ? "sm:border-l" : ""
              }`}
            >
              <Reveal delay={i * 0.06}>
                <p className="label-caps">{f.n}</p>
                <div className="mt-8 h-[140px] w-[140px]">
                  <SiteImage name={f.image} className="h-full w-full" sizes="140px" />
                </div>
                <h3 className="mt-8 text-[19px] font-semibold tracking-[-0.01em] text-ink">
                  {f.title}
                </h3>
                <p className="mt-2 max-w-[30ch] text-[15px] leading-relaxed text-muted">
                  {f.body}
                </p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
