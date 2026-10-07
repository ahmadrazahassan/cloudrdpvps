import type { Metadata } from "next";
import { CalendarClock, CreditCard, LifeBuoy, Mail, PackageCheck, RefreshCw, Server, ShoppingCart, UserPlus, Wallet } from "lucide-react";
import { BarList, DayBars, SplitBar } from "@/components/admin/charts";
import { Ago, AdminHeader, GroupHeading, Mono } from "@/components/admin/parts";
import { Figure, LedgerSection } from "@/components/ledger/primitives";
import { CardLink, Row, RowList } from "@/components/portal/cards";
import { ButtonLink } from "@/components/ui/button";
import { FilterLinks, param, withParams } from "@/components/portal/list-controls";
import { requireConsole } from "@/lib/admin/guard";
import { getActionQueue, getOverviewMoney, getRecentActivity, getWorkLists, isRange, RANGES, type RangeKey } from "@/lib/admin/queries";
import { percentChange } from "@/lib/admin/money";
import { isAdmin } from "@/lib/auth/session";
import { now } from "@/lib/clock";
import { countdown, daysUntil, plural } from "@/lib/format";
import { cn, formatUsd } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

const ACTION_LABEL: Record<string, string> = {
  "payment.approve": "approved a payment",
  "payment.reject": "rejected a payment",
  "service.allocate": "delivered a server",
  "service.extend": "extended a server",
  "service.suspend": "suspended a server",
  "service.unsuspend": "restored a server",
  "service.terminate": "terminated a server",
  "service.credentials_update": "changed server login details",
  "credentials.reveal.admin": "viewed server login details",
  "order.cancel": "cancelled an order",
  "order.refund": "recorded a refund",
  "invoice.void": "voided an invoice",
  "user.set_role": "changed a role",
  "user.set_status": "changed an account status",
};
const describe = (action: string) => ACTION_LABEL[action] ?? action.replace(/[._]/g, " ");

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireConsole();
  const admin = isAdmin(user);
  const sp = await searchParams;
  const requested = param(sp.range);
  const range: RangeKey = isRange(requested) ? requested : "30d";
  const nowMs = now();

  const [queue, work, money, activity] = await Promise.all([
    getActionQueue(),
    getWorkLists(nowMs),
    admin ? getOverviewMoney(range, nowMs) : Promise.resolve(null),
    admin ? getRecentActivity(12) : Promise.resolve([]),
  ]);

  const oldest = queue.oldestPendingPaymentAt ? Math.max(0, nowMs - Date.parse(queue.oldestPendingPaymentAt)) : 0;
  const queueFigures = [
    ...(admin
      ? [
          { icon: CreditCard, label: "Payments to review", value: queue.paymentsToReview, href: "/admin/payments", note: oldest > 0 ? `oldest ${countdown(nowMs + oldest, nowMs)}` : "none waiting", tone: oldest > 4 * 3_600_000 ? ("bad" as const) : oldest > 3_600_000 ? ("warn" as const) : ("default" as const) },
          { icon: PackageCheck, label: "Orders to allocate", value: queue.ordersToAllocate, href: "/admin/orders?view=allocate", note: "paid, awaiting a server", tone: "default" as const },
        ]
      : []),
    { icon: CalendarClock, label: "Expiring ≤ 3 days", value: queue.expiring3d, href: "/admin/services?view=expiring", note: "active servers", tone: "default" as const },
    { icon: LifeBuoy, label: "Tickets need a reply", value: queue.ticketsAwaitingStaff, href: "/admin/tickets", note: "open and unanswered", tone: "default" as const },
    { icon: Mail, label: "Unread messages", value: queue.unreadInbox, href: "/admin/inbox", note: "contact form", tone: "default" as const },
  ];

  const k = money?.kpis;
  const p = money?.previous;
  const renewalRate = k && k.renewals + k.newOrdersCompleted > 0 ? Math.round((k.renewals / (k.renewals + k.newOrdersCompleted)) * 100) : null;
  const prevRenewalRate = p && p.renewals + p.newOrdersCompleted > 0 ? Math.round((p.renewals / (p.renewals + p.newOrdersCompleted)) * 100) : null;

  return (
    <>
      <AdminHeader
        title="Overview"
        description={admin ? "What needs doing now, and how the business is moving." : "What needs doing now."}
        actions={admin ? <ButtonLink href="/admin/reports" variant="secondary" size="sm">Reports & export</ButtonLink> : undefined}
      />

      <section aria-labelledby="queue-heading">
        <GroupHeading title={<span id="queue-heading">Action queue</span>} aside="Live — updates as things arrive" />
        <div className={cn("grid gap-4 sm:grid-cols-2 sm:gap-5", admin ? "xl:grid-cols-5" : "xl:grid-cols-3")}>
          {queueFigures.map((f) => (
            <Figure key={f.label} icon={f.icon} label={f.label} value={f.value} note={f.note} href={f.href} tone={f.value > 0 ? f.tone : "default"} labelLines={2} />
          ))}
        </div>
      </section>

      {money && k && p && (
        <>
          <section aria-labelledby="performance-heading">
            <GroupHeading
              title={<span id="performance-heading">Performance</span>}
              aside={
                <FilterLinks
                  label="Date range"
                  current={money.range.days === 1 ? "today" : money.range.days === 7 ? "7d" : money.range.days === 30 ? "30d" : "90d"}
                  hrefFor={(id) => withParams("/admin", { range: id === "30d" ? null : id })}
                  items={RANGES}
                />
              }
            />
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-5">
              <Figure icon={Wallet} label="Net revenue" value={formatUsd(k.revenueCents)} delta={percentChange(k.revenueCents, p.revenueCents)} note="vs prior period" />
              <Figure icon={ShoppingCart} label="Orders" value={k.orders} delta={percentChange(k.orders, p.orders)} note="placed" />
              <Figure icon={UserPlus} label="New customers" value={k.newCustomers} delta={percentChange(k.newCustomers, p.newCustomers)} note="signed up" />
              <Figure icon={Server} label="Active services" value={k.activeServices} note="running now" />
              <Figure icon={RefreshCw} label="Renewal share" value={renewalRate === null ? "—" : `${renewalRate}%`} delta={renewalRate !== null && prevRenewalRate !== null ? percentChange(renewalRate, prevRenewalRate) : null} note="of orders" />
            </div>
          </section>

          <LedgerSection title="Revenue by day" aside={`${money.range.days === 1 ? "Today" : `Last ${money.range.days} days`}`}>
            <DayBars points={money.points} label="Paid invoices per day" />
          </LedgerSection>

          <div className="grid gap-5 lg:grid-cols-3">
            <LedgerSection title="Orders by country">
              <BarList items={money.byCountry} />
            </LedgerSection>
            <LedgerSection title="Product mix">
              <SplitBar items={money.byProduct} />
            </LedgerSection>
            <LedgerSection title="Payment methods used">
              <BarList items={money.byMethod} empty="No approved payments in this range." />
            </LedgerSection>
          </div>
        </>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <LedgerSection flush title="Oldest unreviewed payments" aside={<CardLink href="/admin/payments">Open queue</CardLink>}>
          {work.payments.length === 0 ? (
            <p className="px-6 py-12 text-center text-[14px] text-muted">Nothing waiting for review.</p>
          ) : (
            <RowList>
              {work.payments.map(({ payment, order, customer }) => (
                <Row key={payment.id} className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">
                      <Mono>{order?.order_number ?? "—"}</Mono> <span className="text-muted">· {customer?.full_name.trim() || customer?.email || "Customer"}</span>
                    </p>
                    <p className="text-[12.5px] text-muted">
                      {payment.method_name} · <Ago value={payment.created_at} nowMs={nowMs} />
                    </p>
                  </div>
                  <span className="num-tabular text-[14px] font-semibold text-ink">{formatUsd(payment.amount_usd_cents)}</span>
                  {admin && (
                    <ButtonLink href={`/admin/payments?p=${payment.id}`} size="sm" variant="secondary" data-row-link>
                      Review
                    </ButtonLink>
                  )}
                </Row>
              ))}
            </RowList>
          )}
        </LedgerSection>

        <LedgerSection flush title="Expiring in 3 days" aside={<CardLink href="/admin/services?view=expiring">All expiring</CardLink>}>
          {work.expiring.length === 0 ? (
            <p className="px-6 py-12 text-center text-[14px] text-muted">No servers expire in the next 3 days.</p>
          ) : (
            <RowList>
              {work.expiring.map(({ service, customer }) => (
                <Row key={service.id} className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">
                      {service.label} <span className="text-muted">· {customer?.full_name.trim() || customer?.email || "Customer"}</span>
                    </p>
                    <p className="text-[12.5px] text-muted">
                      <Mono>{String(service.ip).split("/")[0]}</Mono> · expires in {plural(Math.max(0, daysUntil(service.expires_at, nowMs)), "day")}
                    </p>
                  </div>
                  <ButtonLink href={`/admin/services/${service.id}`} size="sm" variant="secondary" data-row-link>
                    Open
                  </ButtonLink>
                </Row>
              ))}
            </RowList>
          )}
        </LedgerSection>
      </div>

      {admin && (
        <LedgerSection flush title="Recent activity" aside={<CardLink href="/admin/audit-log">Full audit log</CardLink>}>
          {activity.length === 0 ? (
            <p className="px-6 py-12 text-center text-[14px] text-muted">No activity recorded yet.</p>
          ) : (
            <RowList>
              {activity.map(({ event, actor }) => (
                <Row key={event.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-3 text-[14px]">
                  <span className="min-w-0 flex-1 text-ink">
                    <span className="font-medium">{actor ? actor.full_name.trim() || actor.email : "System"}</span> <span className="text-ink-2">{describe(event.action)}</span>
                    {event.reason && <span className="text-muted"> — {event.reason}</span>}
                  </span>
                  <Ago value={event.created_at} nowMs={nowMs} className="text-[12.5px] text-muted" />
                </Row>
              ))}
            </RowList>
          )}
        </LedgerSection>
      )}
    </>
  );
}
