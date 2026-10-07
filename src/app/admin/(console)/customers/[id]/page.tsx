import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerActions } from "@/components/admin/customer-actions";
import { NoteForm } from "@/components/admin/note-form";
import { Ago, AdminHeader, Mono } from "@/components/admin/parts";
import { AdminBadge } from "@/components/admin/status";
import { LifeBuoy, Server, ShoppingCart, Wallet } from "lucide-react";
import { Facts, Figure, LedgerSection } from "@/components/ledger/primitives";
import { Card, Row, RowList } from "@/components/portal/cards";
import { RulerMeter } from "@/components/ledger/ruler-meter";
import { requireConsole } from "@/lib/admin/guard";
import { displayName } from "@/lib/admin/db";
import { getCustomerDetail } from "@/lib/admin/queries";
import { isAdmin } from "@/lib/auth/session";
import { now } from "@/lib/clock";
import { daysUntil, formatDate } from "@/lib/format";
import { formatUsd } from "@/lib/utils";

export const metadata: Metadata = { title: "Customer" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireConsole();
  const admin = isAdmin(user);
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const detail = await getCustomerDetail(id);
  if (!detail) notFound();
  const { profile, orders, services, tickets, notes, people } = detail;
  const nowMs = now();

  const spend = orders.filter((o) => ["approved", "provisioning", "completed"].includes(o.status)).reduce((s, o) => s + o.total_cents, 0);
  const active = services.filter((s) => s.status === "active" && Date.parse(s.expires_at) > nowMs);
  const name = displayName(profile);

  return (
    <>
      <AdminHeader
        title={name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <AdminBadge kind="account" status={profile.status} />
            <a href={`mailto:${profile.email}`} className="hover:text-ink">{profile.email}</a>
            {profile.role !== "customer" && <span className="capitalize">· {profile.role}</span>}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
        <Figure icon={Wallet} label="Lifetime spend" value={admin ? formatUsd(spend) : "—"} note={admin ? "approved orders" : "admins only"} />
        <Figure icon={ShoppingCart} label="Orders" value={orders.length} note="all time" />
        <Figure icon={Server} label="Active servers" value={active.length} note={`${services.length} in total`} />
        <Figure icon={LifeBuoy} label="Tickets" value={tickets.length} note={`${tickets.filter((t) => t.status === "open").length} need a reply`} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <LedgerSection flush title="Servers">
            {services.length === 0 ? (
              <p className="px-6 py-12 text-center text-[14px] text-muted">No servers yet.</p>
            ) : (
              <RowList>
                {services.map((s) => (
                  <Row key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <Link href={`/admin/services/${s.id}`} data-row-link className="min-w-[160px] flex-1 font-semibold text-ink hover:text-lav-700">
                      {s.label}
                      <span className="block text-[12px] font-normal text-muted">
                        <Mono>{String(s.ip).split("/")[0]}</Mono> · {s.plan_name}
                      </span>
                    </Link>
                    <AdminBadge kind="service" status={s.status} />
                    <RulerMeter expiresAt={s.expires_at} daysLeft={daysUntil(s.expires_at, nowMs)} caption={false} className="w-[150px]" />
                  </Row>
                ))}
              </RowList>
            )}
          </LedgerSection>

          <LedgerSection flush title="Orders">
            {orders.length === 0 ? (
              <p className="px-6 py-12 text-center text-[14px] text-muted">No orders yet.</p>
            ) : (
              <RowList>
                {orders.slice(0, 25).map((o) => (
                  <Row key={o.id} className="flex flex-wrap items-center gap-x-5 gap-y-1">
                    <Link href={`/admin/orders/${o.id}`} data-row-link className="font-semibold text-ink hover:text-lav-700">
                      <Mono>{o.order_number}</Mono>
                    </Link>
                    <span className="text-[13.5px] text-ink-2">{o.plan_name} · {o.location_name}</span>
                    <AdminBadge kind="order" status={o.status} />
                    <span className="num-tabular ml-auto text-[14px] text-ink">{formatUsd(o.total_cents)}</span>
                    <Ago value={o.created_at} nowMs={nowMs} className="text-[13px] text-muted" />
                  </Row>
                ))}
              </RowList>
            )}
          </LedgerSection>

          <LedgerSection flush title="Support tickets">
            {tickets.length === 0 ? (
              <p className="px-6 py-12 text-center text-[14px] text-muted">No tickets.</p>
            ) : (
              <RowList>
                {tickets.slice(0, 25).map((t) => (
                  <Row key={t.id} className="flex items-center gap-4">
                    <Link href={`/admin/tickets/${t.id}`} data-row-link className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink hover:text-lav-700">
                      #{t.ticket_no} {t.subject}
                    </Link>
                    <AdminBadge kind="ticket" status={t.status} />
                    <Ago value={t.last_message_at} nowMs={nowMs} className="text-[13px] text-muted" />
                  </Row>
                ))}
              </RowList>
            )}
          </LedgerSection>

          <LedgerSection title="Internal notes" aside="Staff only">
            <NoteForm entityType="customer" entityId={profile.id} />
            {notes.length > 0 && (
              <ul className="mt-6 divide-y divide-line rounded-card border border-line px-4">
                {notes.map((n) => (
                  <li key={n.id} className="py-3">
                    <p className="whitespace-pre-wrap text-[14.5px] text-ink">{n.body}</p>
                    <p className="mt-1 text-[12px] text-muted">
                      {n.author_id ? displayName(people.get(n.author_id)) : "System"} · <Ago value={n.created_at} nowMs={nowMs} />
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </LedgerSection>
        </div>

        <aside className="min-w-0 space-y-5" aria-label="Profile and actions">
          <Card padded>
            <h2 className="mb-4 font-display text-[17px] font-semibold tracking-[-0.016em] text-ink">Profile</h2>
            <Facts
              items={[
                { label: "Email", value: profile.email },
                { label: "Phone", value: profile.phone ?? <span className="font-normal text-muted">—</span> },
                { label: "Country", value: profile.billing_country ?? <span className="font-normal text-muted">—</span> },
                ...(profile.company ? [{ label: "Company", value: profile.company }] : []),
                ...(profile.telegram ? [{ label: "Telegram", value: profile.telegram }] : []),
                ...(profile.whatsapp ? [{ label: "WhatsApp", value: profile.whatsapp }] : []),
                { label: "Joined", value: formatDate(profile.created_at) },
                { label: "Last seen", value: profile.last_seen_at ? <Ago value={profile.last_seen_at} nowMs={nowMs} /> : <span className="font-normal text-muted">—</span> },
              ]}
            />
            {profile.status === "suspended" && profile.suspended_reason && (
              <p className="form-note mt-4" data-tone="error">
                Suspended: {profile.suspended_reason}
              </p>
            )}
          </Card>
          {admin && profile.role === "customer" && (
            <Card padded>
              <h2 className="mb-4 font-display text-[17px] font-semibold tracking-[-0.016em] text-ink">Actions</h2>
              <CustomerActions userId={profile.id} name={name} status={profile.status} />
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
