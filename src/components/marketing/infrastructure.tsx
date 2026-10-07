import Link from "next/link";
import { WindowsOs } from "@/components/brand/windows-logo";
import { Reveal } from "@/components/shared/reveal";
import { Eyebrow } from "@/components/shared/primitives";
import { SiteImage } from "@/components/shared/site-image";
import { getCatalog, specRanges } from "@/lib/catalog";
import { formatPort } from "@/lib/utils";

const rng = (r: readonly [number, number], unit = "") =>
  r[0] === r[1] ? `${r[0]}${unit}` : `${r[0]}–${r[1]}${unit}`;

export async function Infrastructure() {
  const catalog = await getCatalog();
  const s = specRanges(catalog);

  // Facts derived from the real catalog / business rules — not marketing claims.
  const facts = [
    { k: "Locations", v: String(catalog.locations.length) },
    { k: "Plan length", v: "30 days" },
    { k: "Operating system", v: <WindowsOs size={20} className="gap-2.5" /> },
    { k: "Currency", v: "USD" },
  ];

  const rows = [
    { k: "Core systems", v: `${rng(s.vcpu)} vCPU · ${rng(s.ramGb, " GB")} RAM`, href: "/features#core" },
    { k: "Storage", v: `${rng(s.storageGb, " GB")} NVMe`, href: "/features#storage" },
    {
      k: "Network",
      v: `${formatPort(s.portMbps[0])} – ${formatPort(s.portMbps[1])} port · ${rng(s.bandwidthTb, " TB")} bandwidth`,
      href: "/features#network",
    },
    { k: "Access", v: "RDP on port 3389 · Full administrator access", href: "/features#access" },
  ];

  return (
    <section id="infrastructure" className="section-pad border-t border-line">
      <div className="container-site">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <Eyebrow>INFRASTRUCTURE</Eyebrow>
            <h2 className="display-h2 mt-6 max-w-[16ch] text-balance">
              Specs you can read at a glance.
            </h2>
            <p className="mt-5 max-w-[52ch] text-[17px] leading-[1.65] text-ink-2">
              Every plan lists exactly what you get: cores, memory, NVMe storage,
              bandwidth and port speed, in every location. No hidden tiers, no
              guesswork.
            </p>
            <dl className="mt-9 grid grid-cols-2 border-t border-line">
              {facts.map((f, i) => (
                <div
                  key={f.k}
                  className={`border-b border-line py-5 ${i % 2 === 1 ? "border-l pl-6" : "pr-6"}`}
                >
                  <dt className="label-caps">{f.k}</dt>
                  <dd className="num-tabular mt-2 font-display text-xl font-semibold tracking-[-0.016em] text-ink">{f.v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          {/* the aisle drawing sits directly on the page */}
          <Reveal delay={0.08}>
            <SiteImage name="datacenter-aisle" sizes="(min-width: 1024px) 560px, 100vw" />
          </Reveal>
        </div>

        {/* Specification table: type + hairlines only. Lavender is used for the
            heading rule and the links, never as a filled panel. */}
        <Reveal className="mt-14 md:mt-20">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-lav-600 pb-4">
            <h3 className="text-[28px] font-medium leading-none tracking-[-0.02em] text-ink md:text-[34px]">
              Plan specifications
            </h3>
            <p className="label-caps">All plans · all locations</p>
          </div>
          <ul>
            {rows.map((r) => (
              <li
                key={r.k}
                className="grid items-center gap-x-8 gap-y-1 border-b border-line py-5 md:grid-cols-[200px_1fr_auto]"
              >
                <span className="label-caps">{r.k}</span>
                <span className="num-tabular text-[14px] font-medium text-ink">{r.v}</span>
                <Link
                  href={r.href}
                  className="label-caps text-lav-700 underline decoration-lav-300 underline-offset-4 hover:decoration-lav-700"
                >
                  Details
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
