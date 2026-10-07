import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Paperclip } from "lucide-react";
import { Ago, AdminHeader, Mono } from "@/components/admin/parts";
import { AdminBadge } from "@/components/admin/status";
import { TicketControls } from "@/components/admin/ticket-controls";
import { TicketReply } from "@/components/admin/ticket-reply";
import { Facts, LedgerSection } from "@/components/ledger/primitives";
import { requireConsole } from "@/lib/admin/guard";
import { displayName } from "@/lib/admin/db";
import { getTicketDetail } from "@/lib/admin/queries";
import { now } from "@/lib/clock";
import { daysUntil, formatDateTime } from "@/lib/format";
import { cn, formatUsd } from "@/lib/utils";
import { Card, Row, RowList } from "@/components/portal/cards";

export const metadata: Metadata = { title: "Ticket" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireConsole();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const detail = await getTicketDetail(id);
  if (!detail) notFound();
  const { ticket, customer, people, messages, attachments, services, orders, staff, canned } = detail;
  const nowMs = now();

  const staffOptions = staff.map((s) => ({ id: s.id, name: s.full_name.trim() || s.email }));
  const closed = ticket.status === "closed";

  return (
    <>
      <AdminHeader
        title={ticket.subject}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <AdminBadge kind="ticket" status={ticket.status} />
            {ticket.priority !== "normal" && <AdminBadge kind="priority" status={ticket.priority} />}
            <span>#{ticket.ticket_no}</span>
            <span>·</span>
            <span className="capitalize">{ticket.category.replace(/_/g, " ")}</span>
            <span>·</span>
            <span>opened <Ago value={ticket.created_at} nowMs={nowMs} /></span>
          </span>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <LedgerSection flush title="Conversation" aside={`${messages.length} ${messages.length === 1 ? "message" : "messages"}`}>
            <ol className="divide-y divide-line">
              {messages.map((m) => {
                const staffAuthor = m.author_role !== "customer";
                const who = m.author_id ? displayName(people.get(m.author_id)) : "System";
                const files = attachments.get(m.id) ?? [];
                return (
                  <li
                    key={m.id}
                    className={cn("px-6 py-5", m.is_internal ? "bg-warn-bg/60" : staffAuthor && "bg-lav-50/70")}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-[14.5px] font-semibold text-ink">{who}</span>
                      <span className="label-caps !text-[11px]">{m.is_internal ? "Internal note" : staffAuthor ? "Staff" : "Customer"}</span>
                      {m.is_internal && <span className="text-[12px] text-warn">Never shown to the customer</span>}
                      <time dateTime={m.created_at} className="num-tabular ml-auto text-[12px] text-muted" title={`${formatDateTime(m.created_at)} UTC`}>
                        <Ago value={m.created_at} nowMs={nowMs} />
                      </time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">{m.body}</p>
                    {files.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                        {files.map((f) => (
                          <li key={f.url}>
                            <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-lav-700 hover:text-lav-900">
                              <Paperclip size={14} strokeWidth={1.5} aria-hidden />
                              {f.name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </LedgerSection>

          <LedgerSection title={closed ? "Closed" : "Reply"}>
            {closed ? (
              <p className="text-[14px] text-muted">This ticket is closed. Change its status to reply again.</p>
            ) : (
              <TicketReply ticketId={ticket.id} canned={canned.map((c) => ({ id: c.id, title: c.title, body: c.body_md }))} />
            )}
          </LedgerSection>
        </div>

        <aside className="min-w-0 space-y-5" aria-label="Ticket details">
          <Card padded>
            <h2 className="mb-4 font-display text-[17px] font-semibold tracking-[-0.016em] text-ink">Manage</h2>
            <TicketControls ticketId={ticket.id} status={ticket.status} priority={ticket.priority} assignedTo={ticket.assigned_to} staff={staffOptions} me={user.id} />
          </Card>

          <Card padded>
            <h2 className="mb-4 font-display text-[17px] font-semibold tracking-[-0.016em] text-ink">Customer</h2>
            <Facts
              items={[
                { label: "Name", value: customer ? <Link href={`/admin/customers/${customer.id}`} className="hover:text-lav-700">{displayName(customer)}</Link> : "Unknown" },
                { label: "Email", value: customer ? <a href={`mailto:${customer.email}`} className="break-all hover:text-lav-700">{customer.email}</a> : "—" },
                { label: "Account", value: customer ? <AdminBadge kind="account" status={customer.status} /> : "—" },
              ]}
            />
          </Card>

          {services.length > 0 && (
            <LedgerSection flush title="Their servers">
              <RowList>
                {services.map((s) => (
                  <Row key={s.id} className="block py-3">
                    <Link href={`/admin/services/${s.id}`} className="block text-[14px] font-medium text-ink hover:text-lav-700">
                      {s.label}
                      {ticket.service_id === s.id && <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.06em] text-lav-700">This ticket</span>}
                    </Link>
                    <span className="block text-[12.5px] text-muted">
                      <Mono>{String(s.ip).split("/")[0]}</Mono> · {Math.max(0, daysUntil(s.expires_at, nowMs))} days left
                    </span>
                  </Row>
                ))}
              </RowList>
            </LedgerSection>
          )}

          {orders.length > 0 && (
            <LedgerSection flush title="Recent orders">
              <RowList>
                {orders.map((o) => (
                  <Row key={o.id} className="flex items-center justify-between gap-3 py-3 text-[13.5px]">
                    <Link href={`/admin/orders/${o.id}`} className="font-medium text-ink hover:text-lav-700">
                      <Mono>{o.order_number}</Mono>
                    </Link>
                    <span className="num-tabular text-muted">{formatUsd(o.total_cents)}</span>
                    <AdminBadge kind="order" status={o.status} />
                  </Row>
                ))}
              </RowList>
            </LedgerSection>
          )}
        </aside>
      </div>
    </>
  );
}
