import { Check } from "lucide-react";
import { WindowsLogo } from "@/components/brand/windows-logo";
import { Tag } from "@/components/shared/primitives";
import { ButtonLink } from "@/components/ui/button";
import type { Catalog, Location, Plan, ProductType } from "@/lib/catalog";
import { cn, formatPort, formatUsd } from "@/lib/utils";

/** "RDP Standard" → "Standard": the product is already clear from the heading above the cards. */
export const shortPlanName = (name: string) => name.replace(/^(RDP|VPS)\s+/i, "");

/**
 * The plans of one product as pricing cards: a price panel on top, the way to order, and what's included underneath.
 * The recommended plan's panel is lavender and its button is the lavender one.
 *
 * Without a `location` (the homepage, the pricing page, the product pages) nobody has chosen a country, so each plan shows
 * its lowest price anywhere it is in stock, labelled "from". On a country's own page the price is that country's.
 * The order link carries the plan (and the country, when there is one); the order page keeps and shows the choice.
 */
export function PricingCards({
  product,
  catalog,
  location,
  className,
}: {
  product: ProductType;
  catalog: Pick<Catalog, "plans" | "pricing">;
  location?: Pick<Location, "id" | "slug" | "name">;
  className?: string;
}) {
  const plans = catalog.plans.filter((p) => p.product === product);
  return (
    <ul className={cn("grid gap-5 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {plans.map((plan, i) => (
        <li key={plan.id} className="flex">
          <PlanCard plan={plan} product={product} pricing={catalog.pricing} location={location} tagline={plans.length === TAGLINES.length ? TAGLINES[i] : undefined} />
        </li>
      ))}
    </ul>
  );
}

/** One short line per step up the ladder (when there are four plans, as there are for both products). */
const TAGLINES = ["For light, everyday use", "Balanced for most people", "For heavier workloads", "Maximum power and speed"];

function PlanCard({
  plan,
  product,
  pricing,
  location,
  tagline,
}: {
  tagline?: string;
  plan: Plan;
  product: ProductType;
  pricing: Catalog["pricing"];
  location?: Pick<Location, "id" | "slug" | "name">;
}) {
  const rows = pricing.filter((r) => r.planId === plan.id && (!location || r.locationId === location.id));
  const open = rows.filter((r) => r.stock !== "out_of_stock");
  const soldOut = open.length === 0;
  const low = !soldOut && open.every((r) => r.stock === "low");
  const price = soldOut ? null : Math.min(...open.map((r) => r.priceCents));
  const featured = plan.isFeatured && !soldOut;
  const name = shortPlanName(plan.name);
  const href = `/order/new?product=${product}&plan=${plan.slug}${location ? `&country=${location.slug}` : ""}`;

  const included = [
    `${plan.vcpu} vCPU cores`,
    `${plan.ramGb} GB RAM`,
    `${plan.storageGb} GB NVMe storage`,
    `${plan.bandwidthTb} TB bandwidth`,
    `${formatPort(plan.portMbps)} network port`,
  ];

  return (
    <article
      aria-label={plan.name}
      className={cn(
        "flex w-full flex-col rounded-[24px] bg-white p-2.5 shadow-[0_1px_2px_rgb(18_18_20/0.05),0_16px_40px_-20px_rgb(18_18_20/0.2)] transition-transform duration-200 hover:-translate-y-0.5",
        soldOut && "opacity-75",
      )}
    >
      <div className={cn("rounded-[18px] p-5", featured ? "bg-lav-100" : "bg-bg")}>
        <div className="flex min-h-[32px] items-center justify-between gap-2">
          <span className="inline-flex rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold text-ink">{name}</span>
          {featured && !low && <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-lav-800">Recommended</span>}
          {low && <Tag tone="warn">Low stock</Tag>}
          {soldOut && <Tag tone="bad">Out of stock</Tag>}
        </div>
        <p className="num-tabular mt-12 flex items-baseline gap-1.5">
          {!location && price !== null && <span className="text-[13px] text-ink-2">from</span>}
          <span className="font-display text-[46px] font-medium leading-none tracking-[-0.035em] text-ink">{price !== null ? formatUsd(price) : "—"}</span>
          <span className="text-[14px] text-ink-2">/ 30 days</span>
        </p>
      </div>

      <p className="min-h-[22px] px-3.5 pb-4 pt-5 text-[14.5px] font-medium text-ink">{tagline ?? ""}</p>

      <div className="px-1.5">
        {soldOut ? (
          <ButtonLink href={href} variant="secondary" disabled className="w-full" aria-label={`${plan.name} is out of stock`}>
            Out of stock
          </ButtonLink>
        ) : (
          <ButtonLink href={href} variant={featured ? "primary" : "dark"} className="w-full" aria-label={`Order ${plan.name}`}>
            Order now
          </ButtonLink>
        )}
      </div>

      <ul className="mt-6 grid gap-3.5 px-3.5 pb-4 text-[14.5px] text-ink-2">
        {included.map((t) => (
          <li key={t} className="num-tabular flex items-center gap-3">
            <Check size={16} strokeWidth={2} aria-hidden className="shrink-0 text-lav-600" />
            {t}
          </li>
        ))}
        <li className="flex items-center gap-3">
          <WindowsLogo size={15} className="mx-px" />
          Windows Server included
        </li>
        <li className="flex items-center gap-3">
          <Check size={16} strokeWidth={2} aria-hidden className="shrink-0 text-lav-600" />
          Full administrator access
        </li>
      </ul>
    </article>
  );
}
