import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConnectionPanel } from "@/components/portal/connection-panel";
import { ExpiryMeter } from "@/components/portal/expiry-meter";
import { LocalTime } from "@/components/portal/local-time";
import { RenameLabel } from "@/components/portal/rename-label";
import { Section } from "@/components/portal/page-header";
import { StatusBadge } from "@/components/portal/status-badge";
import { CountryFlag, SpecList, Tag } from "@/components/shared/primitives";
import { ButtonLink } from "@/components/ui/button";
import { connectGuides } from "@/content/pages";
import { getCatalog } from "@/lib/catalog";
import { formatDate } from "@/lib/format";
import { credentialsAvailable, serviceState } from "@/lib/portal/derive";
import { getService, getServiceHistory } from "@/lib/portal/queries";
import { cn, formatPort, formatUsd } from "@/lib/utils";

export const metadata: Metadata = { title: "Server" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "connection", label: "Connection" },
  { id: "billing", label: "Billing" },
  { id: "support", label: "Support" },
] as const;

export default async function ServicePage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const service = await getService(id);
  if (!service) notFound();

  const sp = await searchParams;
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab = TABS.find((t) => t.id === tabParam)?.id ?? "overview";

  const [catalog, history] = await Promise.all([getCatalog(), getServiceHistory(service)]);
  const location = catalog.locations.find((l) => l.id === service.location_id);
  const state = serviceState(service);
  const canRenew = state.status === "active" || state.status === "expired";
  const specs = service.plan_specs as Record<string, unknown>;
  const host = String(service.ip).split("/")[0]!;

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5 pb-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <Tag tone="neutral">{service.product.toUpperCase()}</Tag>
            {location && (
              <span className="inline-flex items-center gap-1.5 text-[14px] text-ink-2">
                <CountryFlag iso2={location.iso2} />
                {location.name}
              </span>
            )}
            <StatusBadge kind="service" status={state.status} />
          </div>
          <h1 className="mt-3 font-display text-[28px] font-semibold leading-tight tracking-[-0.024em] text-ink md:text-[32px]">
            <RenameLabel serviceId={service.id} label={service.label} />
          </h1>
          <p className="num-tabular mt-1.5 text-[14px] text-muted">
            {service.plan_name} · {String(specs.vcpu ?? "")} vCPU · {String(specs.ram_gb ?? "")} GB RAM
          </p>
        </div>
        <div className="flex w-full max-w-[360px] flex-col gap-4 sm:items-end">
          <ExpiryMeter expiresAt={service.expires_at} daysLeft={state.daysLeft} className="w-full" />
          {canRenew && (
            <ButtonLink
              href={`/order/new?renew=${service.id}`}
              variant={state.expiringSoon || state.status === "expired" ? "primary" : "secondary"}
            >
              Renew
            </ButtonLink>
          )}
        </div>
      </div>

      {/* Tabs (the URL is the state) */}
      <nav aria-label="Server sections" className="overflow-x-auto">
        <ul className="flex min-w-max gap-8 border-b border-line">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <li key={t.id}>
                <Link
                  href={t.id === "overview" ? `/dashboard/services/${service.id}` : `/dashboard/services/${service.id}?tab=${t.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative -mb-px inline-flex h-12 items-center text-[15px] font-semibold transition-colors",
                    active ? "text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {t.label}
                  {active && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-lav-600" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="pt-10">
        {tab === "overview" && (
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="label-caps border-b-2 border-lav-600 pb-3">Specifications</p>
              <SpecList
                rows={[
                  { label: "vCPU", value: String(specs.vcpu ?? "—") },
                  { label: "RAM", value: `${specs.ram_gb ?? "—"} GB` },
                  { label: "NVMe storage", value: `${specs.storage_gb ?? "—"} GB` },
                  { label: "Bandwidth", value: `${specs.bandwidth_tb ?? "—"} TB` },
                  { label: "Port speed", value: typeof specs.port_mbps === "number" ? formatPort(specs.port_mbps) : "—" },
                  { label: "Operating system", value: "Windows Server" },
                  { label: "Location", value: service.location_id && location ? location.name : "—" },
                  { label: "Started", value: formatDate(service.started_at) },
                  { label: "Expires", value: formatDate(service.expires_at) },
                ]}
              />
            </div>
            <div>
              <p className="label-caps border-b-2 border-lav-600 pb-3">Activity</p>
              <ul>
                {history.orders.map((o) => (
                  <li key={o.id} className="border-b border-line py-3.5">
                    <Link href={`/dashboard/orders/${o.id}`} className="data-id text-[15px] font-semibold text-ink hover:text-lav-700">
                      {o.order_number}
                    </Link>
                    <span className="ml-2 text-[13px] text-muted">
                      {o.type === "renewal" ? "Renewal" : "Original order"} · {formatUsd(o.total_cents, { cents: true })} ·{" "}
                      <LocalTime value={o.created_at} dateOnly />
                    </span>
                  </li>
                ))}
                {history.orders.length === 0 && <li className="py-3.5 text-[14px] text-muted">No orders recorded.</li>}
              </ul>
            </div>
          </div>
        )}

        {tab === "connection" && (
          <div>
            {credentialsAvailable(service) ? (
              <div className="max-w-[760px]">
                <ConnectionPanel serviceId={service.id} host={host} port={service.rdp_port} label={service.label} />
              </div>
            ) : (
              <div className="max-w-[640px] border-l-2 border-warn pl-4">
                <p className="text-[16px] font-semibold text-ink">
                  {state.status === "expired"
                    ? "This server has expired."
                    : state.status === "suspended"
                      ? "This server is suspended."
                      : "Login details aren't available."}
                </p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
                  {state.status === "suspended" && service.suspended_reason
                    ? `${service.suspended_reason} `
                    : ""}
                  Login details are shown only while a server is active.{" "}
                  {canRenew ? "Renew it to get back in." : "Contact support if you think this is a mistake."}
                </p>
                <div className="mt-5 flex gap-3">
                  {canRenew && <ButtonLink href={`/order/new?renew=${service.id}`}>Renew</ButtonLink>}
                  <ButtonLink href={`/dashboard/tickets/new?service=${service.id}`} variant="secondary">
                    Contact support
                  </ButtonLink>
                </div>
              </div>
            )}

            <Section title="Connection guide" className="mt-12 max-w-[760px]" description="Free Remote Desktop clients for every device.">
              <div className="border-t border-line">
                {connectGuides.map((g) => (
                  <details key={g.id} name="guide" className="group border-b border-line">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[16px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                      <span>
                        {g.os}
                        <span className="ml-3 text-[13px] font-normal text-muted">{g.client}</span>
                      </span>
                      <span aria-hidden className="text-muted transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <ol className="mb-5 list-decimal space-y-2 pl-6 text-[15px] leading-relaxed text-ink-2 marker:text-muted">
                      {g.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            </Section>
          </div>
        )}

        {tab === "billing" && (
          <ul className="max-w-[760px] border-t border-line">
            {history.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line py-4">
                <div>
                  <Link href={`/dashboard/orders/${o.id}`} className="data-id text-[15px] font-semibold text-ink hover:text-lav-700">
                    {o.order_number}
                  </Link>
                  <p className="text-[13px] text-muted">
                    {o.type === "renewal" ? "Renewal" : "Original order"} · <LocalTime value={o.created_at} dateOnly />
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="num-tabular text-[15px] font-medium text-ink">{formatUsd(o.total_cents, { cents: true })}</span>
                  <StatusBadge kind="order" status={o.status} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === "support" && (
          <div className="max-w-[760px]">
            <p className="text-[15px] leading-relaxed text-ink-2">
              Servers are managed by our team, so there are no power buttons here. Open a ticket to ask for a restart or a
              reinstall, or if you can&apos;t connect.
            </p>
            <div className="mt-5">
              <ButtonLink href={`/dashboard/tickets/new?service=${service.id}`}>Open a ticket</ButtonLink>
            </div>
            <ul className="mt-8 border-t border-line">
              {history.tickets.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-4">
                  <Link href={`/dashboard/tickets/${t.id}`} className="text-[15px] font-semibold text-ink hover:text-lav-700">
                    #{t.ticket_no} · {t.subject}
                  </Link>
                  <StatusBadge kind="ticket" status={t.status} />
                </li>
              ))}
              {history.tickets.length === 0 && <li className="py-4 text-[14px] text-muted">No tickets for this server yet.</li>}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
