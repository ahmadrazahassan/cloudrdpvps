import type { Metadata } from "next";
import { CountryExplorer } from "@/components/marketing/country-explorer";
import { PageHero } from "@/components/marketing/page-hero";
import { GlobeArt } from "@/components/marketing/globe-art";
import { Reveal } from "@/components/shared/reveal";
import { directoryItems, getCatalog, placesPhrase } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const { locations } = await getCatalog();
  const where = placesPhrase(locations);
  const title = `Locations — Windows RDP and VPS in ${where}`;
  const description = `Choose where your Windows RDP or Windows VPS runs: ${where}, all on the same simple 30-day plans in US dollars.`;
  return { title, description, alternates: { canonical: "/locations" }, openGraph: { title, description, url: "/locations" } };
}

export default async function LocationsPage() {
  const catalog = await getCatalog();
  const where = placesPhrase(catalog.locations);

  return (
    <>
      <PageHero
        crumbs={[{ label: "Locations" }]}
        eyebrow="LOCATIONS"
        title="Servers where you need them."
        lede={`Windows RDP and Windows VPS in ${where}. Every location offers the same plans, the same inclusions and the same simple 30-day term, so you can choose purely on where you want the server to be.`}
        className="pb-10 md:pb-14"
        align="center"
      />

      <section className="pb-12 md:pb-16">
        <div className="container-site">
          <Reveal className="mx-auto w-full max-w-[460px] sm:max-w-[560px]">
            <GlobeArt />
          </Reveal>
        </div>
      </section>

      <section className="section-pad border-t border-line">
        <div className="container-site">
          <div className="text-center">
            <p className="label-caps">EVERY LOCATION</p>
            <h2 className="display-h2 mx-auto mt-6 max-w-[18ch] text-balance">Find your country.</h2>
            <p className="mx-auto mt-5 max-w-[58ch] text-[17px] leading-[1.65] text-ink-2">
              The lowest price for each product in each country, per 30 days. Open a country to see every plan there.
            </p>
          </div>
          <div className="mt-12">
            <CountryExplorer items={directoryItems(catalog)} prices />
          </div>
        </div>
      </section>
    </>
  );
}
