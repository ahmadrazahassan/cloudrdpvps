import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeliverForm } from "@/components/admin/deliver-form";
import { NoteForm } from "@/components/admin/note-form";
import { OrderActions } from "@/components/admin/order-actions";
import { Ago, AdminHeader, Mono } from "@/components/admin/parts";
import { AdminBadge } from "@/components/admin/status";
import { Facts, LedgerSection } from "@/components/ledger/primitives";
import { Card, Row, RowList } from "@/components/portal/cards";
import { requireConsole } from "@/lib/admin/guard";
import { displayName, jsonNumber, jsonString } from "@/lib/admin/db";
import { getOrderDetail } from "@/lib/admin/queries";
import { isAdmin } from "@/lib/auth/session";
import { now } from "@/lib/clock";
import { formatDateTime, specLine } from "@/lib/format";
import { formatUsd } from "@/lib/utils";

export const metadata: Metadata = { title: "Order" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EVENT_LABEL: Record<string, string> = {
  created: "Order placed",
  payment_submitted: "Payment proof submitted",
  payment_approved: "Payment approved",
  payment_rejected: "Payment rejected",
  provisioning_started: "Marked as being set up",
  service_delivered: "Server delivered",
  cancelled_by_customer: "Cancelled by the customer",
  cancelled_by_admin: "Cancelled by staff",
  expired_unpaid: "Cancelled — not paid in time",
  refunded: "Refund recorded",
};

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireConsole();
  const admin = isAdmin(user);
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();
  const detail = await getOrderDetail(id, admin);
  if (!detail) notFound();
  const { order, customer, people, payments, events, services, invoices, notes, stock } = detail;
  const nowMs = now();

  const delivered = services.find((s) => s.order_id === order.id);
  const canDeliver = admin && order.type === "new" && (order.status === "approved" || order.status === "provisioning") && !delivered;
  const termDays = order.term_days;
  const actor = (uid: string | null) => (uid ? displayName(people.get(uid)) : "System");

  return (
    <>
      <AdminHeader
        title={<Mono>{order.order_number}</Mono>}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <AdminBadge kind="order" status={order.status} />
            <span>{order.type === "renewal" ? "Renewal" : "New server"}</span>
            <span>·</span>
            <span>{order.plan_name} · {order.location_name}</span>
          </span>
        }
        actions={
          payments.some((p) => p.status === "pending") ? (
            <Link href={`/admin/payments?p=${payments.find((p) => p.status === "pending")!.id}`} className="btn btn-primary btn-sm">
              Review payment
            </Link>
          ) : undefined
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {canDeliver && (
            <LedgerSection id="deliver" title="Deliver server" aside={order.status === "approved" ? "Paid — waiting for a server" : "Being set up"}>
              <DeliverForm
                orderId={order.id}
                defaultLabel={order.plan_name}
                termDays={termDays}
                autoFocus={sp.deliver === "1"}
                stock={stock.map((s) => ({ id: s.id, ip: String(s.ip).split("/")[0]!, port: s.rdp_port, supplier: s.supplier, addedAt: s.created_at }))}
              />
            </LedgerSection>
          )}

          {delivered && (
            <LedgerSection title="Delivered server">
              <p className="text-[15px] text-ink">
                <Link href={`/admin/services/${delivered.id}`} className="text-link font-semibold">
                  {delivered.label}
                </Link>{" "}
                <span className="text-muted">
                  · <Mono>{String(delivered.ip).split("/")[0]}</Mono> · expires {formatDateTime(delivered.expires_at)} UTC
                </span>
              </p>
            </LedgerSection>
          )}

          <LedgerSection title="Items & totals">
            <Facts
              items={[
                { label: "Plan", value: order.plan_name },
                { label: "Specs", value: specLine(order.plan_specs) || "—" },
                { label: "Location", value: order.location_name },
                { label: "List price", value: formatUsd(order.list_price_cents, { cents: true }) },
                { label: order.coupon_code ? `Discount (${order.coupon_code})` : "Discount", value: order.discount_cents > 0 ? `− ${formatUsd(order.discount_cents, { cents: true })}` : "None" },
                { label: "Total", value: <span className="text-[16px] font-semibold">{formatUsd(order.total_cents, { cents: true })}</span> },
                { label: "Term", value: `${termDays} days` },
              ]}
            />
          </LedgerSection>

          <LedgerSection flush title="Payments">
            {payments.length === 0 ? (
              <p className="px-6 py-12 text-center text-[14px] text-muted">No proof has been submitted.</p>
            ) : (
              <RowList>
                {payments.map((p) => (
                  <Row key={p.id} className="flex flex-wrap items-center gap-x-5 gap-y-1">
                    <AdminBadge kind="payment" status={p.status} />
                    <span className="num-tabular text-[14px] font-semibold text-ink">{formatUsd(p.amount_usd_cents, { cents: true })}</span>
                    <span className="text-[13.5px] text-ink-2">{p.method_name}</span>
                    {p.reference && <Mono className="text-[13px] text-muted">{p.reference}</Mono>}
                    <Ago value={p.created_at} nowMs={nowMs} className="text-[13px] text-muted" />
                    {p.reject_reason && <span className="basis-full text-[13px] text-bad-ink">{p.reject_reason}</span>}
                    <Link href={`/admin/payments?tab=all&p=${p.id}`} className="text-link ml-auto text-[13.5px]">
                      View proof
                    </Link>
                  </Row>
                ))}
              </RowList>
            )}
          </LedgerSection>

          <LedgerSection title="Timeline">
            <ol className="relative">
              {events.map((e, i) => {
                const reason = jsonString(e.data, "reason");
                const amount = jsonNumber(e.data, "amount_cents");
                return (
                  <li key={e.id} className="relative pb-5 pl-7 last:pb-0">
                    {i < events.length - 1 && <span aria-hidden className="absolute bottom-0 left-[5px] top-3 w-px bg-line-2" />}
                    <span aria-hidden className="absolute left-0 top-[7px] h-[11px] w-[11px] rounded-full border-2 border-lav-600 bg-lav-600" />
                    <p className="text-[14.5px] font-medium text-ink">{EVENT_LABEL[e.event] ?? e.event.replace(/_/g, " ")}</p>
                    <p className="num-tabular mt-0.5 text-[12px] text-muted">
                      {formatDateTime(e.created_at)} UTC · {actor(e.actor_id)}
                    </p>
                    {(reason || amount) && (
                      <p className="mt-1 text-[13.5px] text-ink-2">
                        {amount ? `${formatUsd(amount, { cents: true })}. ` : ""}
                        {reason}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </LedgerSection>

          <LedgerSection title="Internal notes" aside="Staff only">
            <NoteForm entityType="order" entityId={order.id} />
            {notes.length > 0 && (
              <ul className="mt-6 divide-y divide-line rounded-card border border-line px-4">
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
        </div>

        <aside className="min-w-0 space-y-5" aria-label="Order summary and actions">
          <Card padded>
            <h2 className="mb-4 font-display text-[17px] font-semibold tracking-[-0.016em] text-ink">Summary</h2>
            <Facts
              items={[
                { label: "Customer", value: customer ? <Link href={`/admin/customers/${customer.id}`} className="hover:text-lav-700">{displayName(customer)}</Link> : "Unknown" },
                { label: "Placed", value: <Ago value={order.created_at} nowMs={nowMs} /> },
                { label: order.status === "awaiting_payment" || order.status === "rejected" ? "Pay by" : "Deadline", value: formatDateTime(order.expires_at) + " UTC" },
                ...(order.completed_at ? [{ label: "Completed", value: formatDateTime(order.completed_at) + " UTC" }] : []),
                ...(order.assigned_to ? [{ label: "Handled by", value: actor(order.assigned_to) }] : []),
                {
                  label: "Invoice",
                  value: invoices[0] ? (
                    <Link href={`/dashboard/billing/invoices/${invoices[0].id}`} className="hover:text-lav-700">
                      <Mono>{invoices[0].invoice_number}</Mono>
                    </Link>
                  ) : (
                    <Link href={`/dashboard/orders/${order.id}/invoice`} className="hover:text-lav-700">
                      Proforma
                    </Link>
                  ),
                },
              ]}
            />
          </Card>
          {admin && (
            <Card padded>
              <h2 className="mb-4 font-display text-[17px] font-semibold tracking-[-0.016em] text-ink">Actions</h2>
              <OrderActions orderId={order.id} orderNumber={order.order_number} status={order.status} type={order.type} totalCents={order.total_cents} />
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
