import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoteForm } from "@/components/admin/note-form";
import { Ago, AdminHeader, Mono } from "@/components/admin/parts";
import { RevealCredentials } from "@/components/admin/reveal-credentials";
import { ServiceActions } from "@/components/admin/service-actions";
import { AdminBadge } from "@/components/admin/status";
import { Facts, LedgerSection } from "@/components/ledger/primitives";
import { RulerMeter } from "@/components/ledger/ruler-meter";
import { CopyButton } from "@/components/portal/copy-button";
import { requireConsole } from "@/lib/admin/guard";
import { displayName, jsonString } from "@/lib/admin/db";
import { getServiceDetail } from "@/lib/admin/queries";
import { isAdmin } from "@/lib/auth/session";
import { now } from "@/lib/clock";
import { daysUntil, formatDateTime, specLine } from "@/lib/format";
import { serviceState } from "@/lib/portal/derive";
import { formatUsd } from "@/lib/utils";

export const metadata: Metadata = { title: "Server" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AUDIT_LABEL: Record<string, string> = {
  "service.allocate": "Delivered",
  "service.extend": "Extended",
  "service.suspend": "Suspended",
  "service.unsuspend": "Restored",
  "service.terminate": "Terminated",
  "service.credentials_update": "Login details changed",
  "credentials.reveal": "Customer viewed the login",
  "credentials.reveal.admin": "Staff viewed the login",
};

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireConsole();
  const admin = isAdmin(user);
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const detail = await getServiceDetail(id, admin);
  if (!detail) notFound();
  const { service, customer, people, orders, tickets, notes, audit, inventory } = detail;
  const nowMs = now();
  const state = serviceState(service, nowMs);
  const ip = String(service.ip).split("/")[0]!;
  const actor = (uid: string | null) => (uid ? displayName(people.get(uid)) : "System");

  return (
    <>
      <AdminHeader
        title={service.label}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <AdminBadge kind="service" status={state.status} />
            <span>
              {service.product.toUpperCase()} · {service.plan_name}
            </span>
            <span>·</span>
            <Mono>{ip}</Mono>
            <CopyButton value={ip} label={`Copy ${ip}`} />
          </span>
        }
      />

      <div className="grid gap-x-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <LedgerSection n={1} title="Term">
            <RulerMeter expiresAt={service.expires_at} daysLeft={daysUntil(service.expires_at, nowMs)} />
            {service.status === "suspended" && service.suspended_reason && (
              <p className="form-note mt-5" data-tone="error">
                Suspended: {service.suspended_reason}
              </p>
            )}
          </LedgerSection>

          <LedgerSection n={2} title="Connection" aside={admin ? undefined : "Login details are visible to admins only"}>
            <Facts
              items={[
                { label: "Address", value: <Mono>{ip}{service.rdp_port !== 3389 ? `:${service.rdp_port}` : ""}</Mono> },
                ...(service.hostname ? [{ label: "Hostname", value: service.hostname }] : []),
                { label: "Specs", value: specLine(service.plan_specs) || "—" },
                { label: "Started", value: formatDateTime(service.started_at) + " UTC" },
                { label: "Expires", value: formatDateTime(service.expires_at) + " UTC" },
              ]}
            />
            {admin && service.status !== "terminated" && (
              <div className="mt-6">
                <RevealCredentials serviceId={service.id} />
              </div>
            )}
          </LedgerSection>

          <LedgerSection n={3} title="Orders & renewals">
            <ul className="border-t border-line">
              {orders.map((o) => (
                <li key={o.id} className="ledger-row flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line py-3 pl-3">
                  <Link href={`/admin/orders/${o.id}`} className="font-semibold text-ink hover:text-lav-700" data-row-link>
                    <Mono>{o.order_number}</Mono>
                  </Link>
                  <span className="text-[13px] text-muted">{o.type === "renewal" ? "Renewal" : "Original order"}</span>
                  <AdminBadge kind="order" status={o.status} />
                  <span className="num-tabular ml-auto text-[14px] text-ink">{formatUsd(o.total_cents)}</span>
                  <Ago value={o.created_at} nowMs={nowMs} className="text-[13px] text-muted" />
                </li>
              ))}
            </ul>
          </LedgerSection>

          {tickets.length > 0 && (
            <LedgerSection n={4} title="Support tickets">
              <ul className="border-t border-line">
                {tickets.map((t) => (
                  <li key={t.id} className="ledger-row flex items-center gap-4 border-b border-line py-3 pl-3">
                    <Link href={`/admin/tickets/${t.id}`} className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink hover:text-lav-700" data-row-link>
                      #{t.ticket_no} {t.subject}
                    </Link>
                    <AdminBadge kind="ticket" status={t.status} />
                  </li>
                ))}
              </ul>
            </LedgerSection>
          )}

          <LedgerSection n={tickets.length > 0 ? 5 : 4} title="Internal notes" aside="Staff only">
            <NoteForm entityType="service" entityId={service.id} />
            {notes.length > 0 && (
              <ul className="mt-6 divide-y divide-line border-y border-line">
                {notes.map((n) => (
                  <li key={n.id} className="py-3">
                    <p className="whitespace-pre-wrap text-[14.5px] text-ink">{n.body}</p>
                    <p className="mt-1 text-[12px] text-muted">
                      {actor(n.author_id)} · <Ago value={n.created_at} nowMs={nowMs} />
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </LedgerSection>

          {admin && audit.length > 0 && (
            <LedgerSection n={tickets.length > 0 ? 6 : 5} title="Activity">
              <ol className="border-t border-line">
                {audit.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 border-b border-line py-2.5 text-[13.5px]">
                    <span className="min-w-0 flex-1 text-ink">
                      <span className="font-medium">{AUDIT_LABEL[a.action] ?? a.action}</span>
                      {a.reason && <span className="text-muted"> — {a.reason}</span>}
                      {jsonString(a.after, "expires_at") && <span className="text-muted"> · until {formatDateTime(jsonString(a.after, "expires_at")!)} UTC</span>}
                    </span>
                    <span className="text-[12.5px] text-muted">
                      {actor(a.actor_id)} · <Ago value={a.created_at} nowMs={nowMs} />
                    </span>
                  </li>
                ))}
              </ol>
            </LedgerSection>
          )}
        </div>

        <aside className="min-w-0 lg:border-l lg:border-line lg:pl-10" aria-label="Server summary and actions">
          <div className="space-y-8 pt-4">
            <div>
              <p className="label-caps mb-2">Summary</p>
              <Facts
                items={[
                  { label: "Customer", value: customer ? <Link href={`/admin/customers/${customer.id}`} className="hover:text-lav-700">{displayName(customer)}</Link> : "Unknown" },
                  { label: "Location", value: orders[0]?.location_name ?? "—" },
                  { label: "Created", value: <Ago value={service.created_at} nowMs={nowMs} /> },
                  ...(inventory ? [{ label: "From stock", value: inventory.supplier ?? "Yes" }, ...(inventory.supplier_cost_cents != null ? [{ label: "Supplier cost", value: formatUsd(inventory.supplier_cost_cents, { cents: true }) }] : [])] : []),
                ]}
              />
            </div>
            {admin && (
              <div>
                <p className="label-caps mb-3">Actions</p>
                <ServiceActions serviceId={service.id} label={service.label} status={service.status} expiresAt={service.expires_at} nowMs={nowMs} termDays={30} />
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
