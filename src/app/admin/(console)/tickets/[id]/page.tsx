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
import { formatUsd } from "@/lib/utils";

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

      <div className="grid gap-x-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <LedgerSection n={1} title="Conversation">
            <ol className="space-y-0 border-t border-line">
              {messages.map((m) => {
                const staffAuthor = m.author_role !== "customer";
                const who = m.author_id ? displayName(people.get(m.author_id)) : "System";
                const files = attachments.get(m.id) ?? [];
                return (
                  <li
                    key={m.id}
                    className={`border-b border-line py-5 pl-4 ${m.is_internal ? "border-l-2 border-l-warn" : staffAuthor ? "border-l-2 border-l-lav-500" : "border-l-2 border-l-transparent"}`}
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

          <LedgerSection n={2} title={closed ? "Closed" : "Reply"}>
            {closed ? (
              <p className="text-[14px] text-muted">This ticket is closed. Change its status to reply again.</p>
            ) : (
              <TicketReply ticketId={ticket.id} canned={canned.map((c) => ({ id: c.id, title: c.title, body: c.body_md }))} />
            )}
          </LedgerSection>
        </div>

        <aside className="min-w-0 lg:border-l lg:border-line lg:pl-10" aria-label="Ticket details">
          <div className="space-y-8 pt-4">
            <TicketControls ticketId={ticket.id} status={ticket.status} priority={ticket.priority} assignedTo={ticket.assigned_to} staff={staffOptions} me={user.id} />

            <div>
              <p className="label-caps mb-2">Customer</p>
              <Facts
                items={[
                  { label: "Name", value: customer ? <Link href={`/admin/customers/${customer.id}`} className="hover:text-lav-700">{displayName(customer)}</Link> : "Unknown" },
                  { label: "Email", value: customer ? <a href={`mailto:${customer.email}`} className="break-all hover:text-lav-700">{customer.email}</a> : "—" },
                  { label: "Account", value: customer ? <AdminBadge kind="account" status={customer.status} /> : "—" },
                ]}
              />
            </div>

            {services.length > 0 && (
              <div>
                <p className="label-caps mb-2">Their servers</p>
                <ul className="divide-y divide-line border-y border-line">
                  {services.map((s) => (
                    <li key={s.id} className="py-2.5">
                      <Link href={`/admin/services/${s.id}`} className="block text-[14px] font-medium text-ink hover:text-lav-700">
                        {s.label}
                        {ticket.service_id === s.id && <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.06em] text-lav-700">This ticket</span>}
                      </Link>
                      <span className="block text-[12.5px] text-muted">
                        <Mono>{String(s.ip).split("/")[0]}</Mono> · {Math.max(0, daysUntil(s.expires_at, nowMs))} days left
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {orders.length > 0 && (
              <div>
                <p className="label-caps mb-2">Recent orders</p>
                <ul className="divide-y divide-line border-y border-line">
                  {orders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-[13.5px]">
                      <Link href={`/admin/orders/${o.id}`} className="font-medium text-ink hover:text-lav-700">
                        <Mono>{o.order_number}</Mono>
                      </Link>
                      <span className="num-tabular text-muted">{formatUsd(o.total_cents)}</span>
                      <AdminBadge kind="order" status={o.status} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
