import { getCatalog } from "@/lib/catalog";
import { PlansOverview } from "./plans-overview";

export async function Pricing() {
  const catalog = await getCatalog();
  return (
    <section id="pricing" className="section-pad border-t border-line">
      <div className="container-site">
        <div className="text-center">
          <p className="label-caps">PRICING</p>
          <h2 className="display-h2 mx-auto mt-6 max-w-[20ch] text-balance">
            Straightforward <span className="whitespace-nowrap">30-day</span> pricing.
          </h2>
          <p className="mx-auto mt-5 max-w-[58ch] text-[17px] leading-[1.65] text-ink-2">
            Every plan is shown below, RDP and VPS. Prices are in US dollars and every plan
            runs for 30 days. You choose your country when you place the order.
          </p>
        </div>

        <div className="mt-12">
          <PlansOverview catalog={catalog} />
        </div>

        <p className="mt-10 text-center text-sm text-muted">
          All plans run for 30 days. Renew any time before expiry to add another 30
          days. Windows Server is included with every plan.
        </p>
      </div>
    </section>
  );
}
