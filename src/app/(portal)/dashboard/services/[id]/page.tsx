import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Row, RowList, SummaryList, Tabs } from "@/components/portal/cards";
import { ConnectionPanel } from "@/components/portal/connection-panel";
import { ExpiryMeter } from "@/components/portal/expiry-meter";
import { LocalTime } from "@/components/portal/local-time";
import { Section } from "@/components/portal/page-header";
import { RenameLabel } from "@/components/portal/rename-label";
import { StatusBadge } from "@/components/portal/status-badge";
import { CountryFlag } from "@/components/shared/primitives";
import { ButtonLink } from "@/components/ui/button";
import { connectGuides } from "@/content/pages";
import { getCatalog } from "@/lib/catalog";
import { formatDate } from "@/lib/format";
import { credentialsAvailable, serviceState } from "@/lib/portal/derive";
import { getService, getServiceHistory } from "@/lib/portal/queries";
import { formatPort, formatUsd } from "@/lib/utils";

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
  const base = `/dashboard/services/${service.id}`;

  return (
    <>
      {/* Header card */}
      <Card padded className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <StatusBadge kind="service" status={state.status} />
              {location && (
                <span className="inline-flex items-center gap-1.5 text-[14px] text-ink-2">
                  <CountryFlag iso2={location.iso2} />
                  {location.name}
                </span>
              )}
              <span className="text-[14px] text-muted">{service.product === "rdp" ? "Windows RDP" : "Windows VPS"}</span>
            </div>
            <h1 className="mt-3 font-display text-[26px] font-semibold leading-tight tracking-[-0.026em] text-ink md:text-[30px]">
              <RenameLabel serviceId={service.id} label={service.label} />
            </h1>
            <p className="num-tabular mt-1.5 text-[14px] text-muted">
              {service.plan_name} · {String(specs.vcpu ?? "")} vCPU · {String(specs.ram_gb ?? "")} GB RAM
            </p>
          </div>
          <div className="flex w-full max-w-[380px] flex-col gap-4 sm:items-end">
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
      </Card>

      <Tabs
        className="mb-5"
        label="Server sections"
        current={tab}
        items={TABS.map((t) => ({ id: t.id, label: t.label }))}
        hrefFor={(tid) => (tid === "overview" ? base : `${base}?tab=${tid}`)}
      />

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Specifications">
            <SummaryList
              items={[
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
          </Section>
          <Card aria-labelledby="activity-heading" className="self-start">
            <header className="border-b border-line px-5 py-5 sm:px-6">
              <h2 id="activity-heading" className="font-display text-[17px] font-semibold leading-snug tracking-[-0.016em] text-ink">
                Activity
              </h2>
            </header>
            {history.orders.length === 0 ? (
              <p className="px-5 py-8 text-[14px] text-muted sm:px-6">No orders recorded.</p>
            ) : (
              <RowList>
                {history.orders.map((o) => (
                  <Row key={o.id} className="py-3.5">
                    <Link href={`/dashboard/orders/${o.id}`} className="data-id text-[15px] font-semibold text-ink hover:text-lav-700">
                      {o.order_number}
                    </Link>
                    <p className="text-[13px] text-muted">
                      {o.type === "renewal" ? "Renewal" : "Original order"} · {formatUsd(o.total_cents, { cents: true })} ·{" "}
                      <LocalTime value={o.created_at} dateOnly />
                    </p>
                  </Row>
                ))}
              </RowList>
            )}
          </Card>
        </div>
      )}

      {tab === "connection" && (
        <div className="space-y-5">
          {credentialsAvailable(service) ? (
            <Section split title="Login details" description="Host and port are always visible. Reveal your username and password only when you need them.">
              <ConnectionPanel serviceId={service.id} host={host} port={service.rdp_port} label={service.label} />
            </Section>
          ) : (
            <Card padded role="status" className="border-warn/30 bg-warn-bg">
              <p className="text-[16px] font-semibold text-ink">
                {state.status === "expired"
                  ? "This server has expired."
                  : state.status === "suspended"
                    ? "This server is suspended."
                    : "Login details aren't available."}
              </p>
              <p className="mt-1.5 max-w-[64ch] text-[15px] leading-relaxed text-ink-2">
                {state.status === "suspended" && service.suspended_reason ? `${service.suspended_reason} ` : ""}
                Login details are shown only while a server is active.{" "}
                {canRenew ? "Renew it to get back in." : "Contact support if you think this is a mistake."}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {canRenew && <ButtonLink href={`/order/new?renew=${service.id}`}>Renew</ButtonLink>}
                <ButtonLink href={`/dashboard/tickets/new?service=${service.id}`} variant="secondary">
                  Contact support
                </ButtonLink>
              </div>
            </Card>
          )}

          <Section split title="Connection guide" description="Free Remote Desktop clients for every device.">
            <div className="space-y-3">
              {connectGuides.map((g) => (
                <details key={g.id} name="guide" className="group rounded-card border border-line px-4 open:bg-surface-2/60">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-[16px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                    <span>
                      {g.os}
                      <span className="ml-3 text-[13px] font-normal text-muted">{g.client}</span>
                    </span>
                    <span aria-hidden className="text-muted transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <ol className="mb-4 list-decimal space-y-2 pl-6 text-[15px] leading-relaxed text-ink-2 marker:text-muted">
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
        <Card>
          {history.orders.length === 0 ? (
            <p className="px-5 py-10 text-center text-[14px] text-muted sm:px-6">No orders recorded.</p>
          ) : (
            <RowList>
              {history.orders.map((o) => (
                <Row key={o.id} className="flex flex-wrap items-center justify-between">
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
                </Row>
              ))}
            </RowList>
          )}
        </Card>
      )}

      {tab === "support" && (
        <Section
          split
          title="Need a hand?"
          description="Servers are managed by our team, so there are no power buttons here."
          actions={<ButtonLink href={`/dashboard/tickets/new?service=${service.id}`}>Open a ticket</ButtonLink>}
        >
          <p className="text-[15px] leading-relaxed text-ink-2">
            Open a ticket to ask for a restart or a reinstall, or if you can&apos;t connect.
          </p>
          <p className="mt-6 text-[13px] font-medium text-muted">Tickets for this server</p>
          {history.tickets.length === 0 ? (
            <p className="mt-2 text-[14px] text-muted">No tickets for this server yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-card border border-line px-4">
              {history.tickets.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                  <Link href={`/dashboard/tickets/${t.id}`} className="text-[15px] font-semibold text-ink hover:text-lav-700">
                    #{t.ticket_no} · {t.subject}
                  </Link>
                  <StatusBadge kind="ticket" status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </>
  );
}
