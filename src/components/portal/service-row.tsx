import Link from "next/link";
import { CountryFlag, Tag } from "@/components/shared/primitives";
import { ButtonLink } from "@/components/ui/button";
import type { Location } from "@/content/catalog";
import { specLine } from "@/lib/format";
import { serviceState } from "@/lib/portal/derive";
import type { Service } from "@/lib/portal/queries";
import { CopyButton } from "./copy-button";
import { ExpiryMeter } from "./expiry-meter";
import { StatusBadge } from "./status-badge";

/**
 * One server as an open row: name and place on the left, specs and address in the
 * middle, the term meter, and the actions. Rows are separated by hairlines — no card.
 */
export function ServiceRow({
  service,
  location,
  state = serviceState(service),
}: {
  service: Service;
  location?: Pick<Location, "name" | "iso2">;
  state?: ReturnType<typeof serviceState>;
}) {
  const renewProminent = state.status === "expired" || state.expiringSoon;
  const canRenew = state.status === "active" || state.status === "expired";

  return (
    <li className="grid gap-5 border-b border-line py-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,1fr)_176px] md:items-center md:gap-8">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="neutral">{service.product.toUpperCase()}</Tag>
          {location && (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
              <CountryFlag iso2={location.iso2} />
              {location.name}
            </span>
          )}
        </div>
        <h3 className="mt-2.5 truncate text-[18px] font-semibold tracking-[-0.012em] text-ink">
          <Link href={`/dashboard/services/${service.id}`} className="hover:text-lav-700">
            {service.label}
          </Link>
        </h3>
        <div className="mt-2">
          <StatusBadge kind="service" status={state.status} />
        </div>
      </div>

      <div className="min-w-0">
        <p className="num-tabular text-[13px] text-muted">{specLine(service.plan_specs)}</p>
        <p className="data-id mt-1.5 flex items-center gap-1 text-[15px] font-medium text-ink">
          {String(service.ip)}
          <CopyButton value={String(service.ip)} label={`Copy IP address of ${service.label}`} />
        </p>
      </div>

      <ExpiryMeter expiresAt={service.expires_at} daysLeft={state.daysLeft} />

      <div className="flex gap-2 md:justify-end">
        <ButtonLink href={`/dashboard/services/${service.id}`} variant="secondary" size="sm">
          Open
        </ButtonLink>
        {canRenew && (
          <ButtonLink href={`/order/new?renew=${service.id}`} variant={renewProminent ? "primary" : "secondary"} size="sm">
            Renew
          </ButtonLink>
        )}
      </div>
    </li>
  );
}
