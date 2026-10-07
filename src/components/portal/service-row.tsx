import Link from "next/link";
import { CountryFlag } from "@/components/shared/primitives";
import { ButtonLink } from "@/components/ui/button";
import type { Location } from "@/content/catalog";
import { specLine } from "@/lib/format";
import { serviceState } from "@/lib/portal/derive";
import type { Service } from "@/lib/portal/queries";
import { Row, TableHead } from "./cards";
import { CopyButton } from "./copy-button";
import { ExpiryMeter } from "./expiry-meter";
import { StatusBadge } from "./status-badge";

/** Column layout shared by the header and every row (desktop); on phones each row stacks. */
const COLS = "md:grid-cols-[minmax(0,1.35fr)_132px_minmax(0,1.15fr)_minmax(0,1.25fr)_auto]";

export function ServiceTableHead() {
  return (
    <TableHead className={COLS}>
      <span>Server</span>
      <span>Status</span>
      <span>Address</span>
      <span>Term</span>
      <span className="w-[148px]" />
    </TableHead>
  );
}

/**
 * One server as a table row: name and place, status, address with its specs, the term ruler, and the
 * actions. Place it in a `RowList` inside a card (under a `ServiceTableHead`).
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
    <Row className={COLS}>
      <div className="min-w-0">
        <h3 className="truncate text-[16px] font-semibold tracking-[-0.012em] text-ink">
          <Link href={`/dashboard/services/${service.id}`} className="hover:text-lav-700">
            {service.label}
          </Link>
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
          {location && (
            <span className="inline-flex items-center gap-1.5">
              <CountryFlag iso2={location.iso2} />
              {location.name}
            </span>
          )}
          <span aria-hidden>·</span>
          <span>{service.product === "rdp" ? "Windows RDP" : "Windows VPS"}</span>
        </p>
      </div>

      <div>
        <StatusBadge kind="service" status={state.status} />
      </div>

      <div className="min-w-0">
        <p className="data-id flex items-center gap-1 text-[15px] font-medium text-ink">
          {String(service.ip)}
          <CopyButton value={String(service.ip)} label={`Copy IP address of ${service.label}`} />
        </p>
        <p className="num-tabular text-[12px] text-muted">{specLine(service.plan_specs)}</p>
      </div>

      <ExpiryMeter expiresAt={service.expires_at} daysLeft={state.daysLeft} />

      <div className="flex gap-2 md:w-[148px] md:justify-end">
        <ButtonLink href={`/dashboard/services/${service.id}`} variant="secondary" size="sm">
          Open
        </ButtonLink>
        {canRenew && (
          <ButtonLink href={`/order/new?renew=${service.id}`} variant={renewProminent ? "primary" : "secondary"} size="sm">
            Renew
          </ButtonLink>
        )}
      </div>
    </Row>
  );
}
