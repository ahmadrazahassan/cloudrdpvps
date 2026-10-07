import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/page-hero";
import { Eyebrow } from "@/components/shared/primitives";
import { Reveal } from "@/components/shared/reveal";
import { SiteImage } from "@/components/shared/site-image";
import { ButtonLink } from "@/components/ui/button";
import { connectGuides, expectations, productPages } from "@/content/pages";
import { getCatalog, specRanges, type ProductType } from "@/lib/catalog";
import { formatPort } from "@/lib/utils";

const title = "Features — what every Windows RDP and VPS plan includes";
const description =
  "Windows Server, full administrator access, NVMe storage and clear specs on every plan. See how access works and what to expect from delivery and support.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/features" },
  openGraph: { title, description, url: "/features" },
};

const range = (r: readonly [number, number], unit = "") =>
  r[0] === r[1] ? `${r[0]}${unit}` : `${r[0]}–${r[1]}${unit}`;

const PRODUCTS: ProductType[] = ["rdp", "vps"];

function Block({
  id,
  n,
  title,
  body,
  children,
}: {
  id: string;
  n: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="section-pad border-t border-line">
      <div className="container-site grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <Reveal className="min-w-0">
          <p className="label-caps">{n}</p>
          <h2 className="display-h2 mt-6 max-w-[14ch] text-balance">{title}</h2>
          <p className="mt-5 max-w-[44ch] text-[17px] leading-[1.65] text-ink-2">{body}</p>
        </Reveal>
        {/* min-w-0: a grid item won't shrink below its content unless told to, which would push the table off-screen. */}
        <Reveal delay={0.06} className="min-w-0">
          {children}
        </Reveal>
      </div>
    </section>
  );
}

/** Product × metric rows, open table with hairlines. */
function RangeTable({
  label,
  heads,
  rows,
}: {
  label: string;
  heads: string[];
  rows: { label: string; values: string[] }[];
}) {
  return (
    // Scrolls sideways on phones, so it must be keyboard-focusable (and named) to be reachable without a mouse.
    <div role="region" aria-label={label} tabIndex={0} className="relative overflow-x-auto">
      <table className="w-full min-w-[420px] text-left">
        <thead>
          <tr className="label-caps border-b-2 border-lav-600">
            <th scope="col" className="py-3 pr-4 font-normal">
              <span className="sr-only">Product</span>
            </th>
            {heads.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 text-right font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="num-tabular">
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line">
              <th scope="row" className="py-4 pr-4 text-[15px] font-semibold text-ink">
                {r.label}
              </th>
              {r.values.map((v, i) => (
                <td key={heads[i]} className="px-4 py-4 text-right text-[15px] text-ink">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function FeaturesPage() {
  const catalog = await getCatalog();
  const s = Object.fromEntries(PRODUCTS.map((p) => [p, specRanges(catalog, p)])) as Record<
    ProductType,
    ReturnType<typeof specRanges>
  >;
  const rows = (f: (r: ReturnType<typeof specRanges>) => string[]) =>
    PRODUCTS.map((p) => ({ label: productPages[p].label, values: f(s[p]) }));

  return (
    <>
      <PageHero
        crumbs={[{ label: "Features" }]}
        eyebrow="FEATURES"
        title="Everything you need, nothing you don't."
        lede="Every plan comes with Windows Server, full administrator access and NVMe storage, in every location. Here is exactly what that means, how you connect, and what to expect from us."
        actions={
          <>
            <ButtonLink href="/pricing" size="lg">
              View pricing
            </ButtonLink>
            <ButtonLink href="/contact" variant="secondary" size="lg">
              Ask a question
            </ButtonLink>
          </>
        }
        art={<SiteImage name="hero-server-exploded" priority className="w-full" sizes="(min-width: 1024px) 520px, 90vw" />}
      />

      <Block
        id="core"
        n="001"
        title="Core systems"
        body="Plans are listed by cores and memory so you can match a plan to your workload without guessing. Larger plans step up in both."
      >
        <RangeTable label="Cores and memory by product" heads={["vCPU", "RAM"]} rows={rows((r) => [range(r.vcpu), range(r.ramGb, " GB")])} />
      </Block>

      <Block
        id="storage"
        n="002"
        title="NVMe storage"
        body="Every plan uses fast NVMe disks, for responsive desktops and applications. Storage grows with the plan you choose."
      >
        <RangeTable label="Storage by product" heads={["NVMe storage"]} rows={rows((r) => [range(r.storageGb, " GB")])} />
      </Block>

      <Block
        id="network"
        n="003"
        title="Network"
        body="Each plan lists its port speed and monthly bandwidth, so there is nothing to discover after you order."
      >
        <RangeTable
          label="Network by product"
          heads={["Port speed", "Bandwidth"]}
          rows={rows((r) => [
            `${formatPort(r.portMbps[0])} – ${formatPort(r.portMbps[1])}`,
            range(r.bandwidthTb, " TB"),
          ])}
        />
      </Block>

      <Block
        id="access"
        n="004"
        title="Access"
        body="You connect with the standard Remote Desktop client and sign in as an administrator, so you can install and configure Windows the way you want."
      >
        <dl className="border-t border-line">
          {[
            { k: "Protocol", v: "Remote Desktop (RDP) on port 3389" },
            { k: "Account", v: "Administrator login, delivered in your dashboard" },
            { k: "Operating system", v: "Windows Server, included" },
            { k: "Password", v: "Stored encrypted and shown to you only when you ask for it" },
          ].map((r) => (
            <div key={r.k} className="grid gap-1 border-b border-line py-4 sm:grid-cols-[180px_1fr] sm:gap-6">
              <dt className="label-caps">{r.k}</dt>
              <dd className="text-[15px] font-medium text-ink">{r.v}</dd>
            </div>
          ))}
        </dl>
      </Block>

      {/* How to connect */}
      <section id="connect" className="section-pad border-t border-line">
        <div className="container-site">
          <Eyebrow>CONNECTING</Eyebrow>
          <h2 className="display-h2 mt-6 max-w-[20ch] text-balance">Connect from any device.</h2>
          <p className="mt-5 max-w-[58ch] text-[17px] leading-[1.65] text-ink-2">
            Your dashboard shows the IP address, port, username and password. Use any of these free Remote Desktop
            clients.
          </p>

          <div className="ruled-wrap mt-12">
            <div className="ruled grid md:grid-cols-2 xl:grid-cols-4">
              {connectGuides.map((g) => (
                <article key={g.id} className="px-0 py-8 md:px-7">
                  <p className="label-caps">{g.os}</p>
                  <h3 className="mt-3 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink">{g.client}</h3>
                  <ol className="mt-5 list-decimal space-y-2.5 pl-5 text-[14px] leading-relaxed text-ink-2 marker:text-muted">
                    {g.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What to expect */}
      <section id="expect" className="section-pad border-t border-line">
        <div className="container-site grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <div>
            <Eyebrow>WHAT TO EXPECT</Eyebrow>
            <h2 className="display-h2 mt-6 max-w-[14ch] text-balance">Plainly stated.</h2>
            <p className="mt-5 max-w-[40ch] text-[17px] leading-[1.65] text-ink-2">
              A few things work differently from a fully automated host. We would rather you know before you order.
            </p>
          </div>
          <ul className="border-t border-line">
            {expectations.map((e) => (
              <li key={e.title} className="border-b border-line py-6">
                <h3 className="text-[18px] font-semibold text-ink">{e.title}</h3>
                <p className="mt-1.5 max-w-[56ch] text-[15px] leading-relaxed text-muted">{e.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

    </>
  );
}
