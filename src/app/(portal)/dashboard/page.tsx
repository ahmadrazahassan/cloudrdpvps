import type { Metadata } from "next";
import { CalendarClock, LifeBuoy, ReceiptText, Server } from "lucide-react";
import { Card, CardHeader, CardLink, Row, RowList, StatCard, TableHead } from "@/components/portal/cards";
import { HealthGauge, TermChart, TermLegend, type TermBar } from "@/components/portal/charts";
import { EmptyState } from "@/components/portal/empty-state";
import { Greeting } from "@/components/portal/greeting";
import { LocalTime } from "@/components/portal/local-time";
import { NotificationItem } from "@/components/portal/notification-item";
import { PageHeader } from "@/components/portal/page-header";
import { ServiceRow, ServiceTableHead } from "@/components/portal/service-row";
import { StatusBadge } from "@/components/portal/status-badge";
import { CountryFlag } from "@/components/shared/primitives";
import { ButtonLink } from "@/components/ui/button";
import { firstName, formatDate, plural } from "@/lib/format";
import { requireUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";
import { now as clock } from "@/lib/clock";
import { attentionItems, inProgress, needsPayment, serviceState } from "@/lib/portal/derive";
import { getOverview, listOrders } from "@/lib/portal/queries";
import { formatUsd } from "@/lib/utils";
import Link from "next/link";

export const metadata: Metadata = { title: "Overview" };

const ATTENTION_ICON = { pay: ReceiptText, renew: CalendarClock, ticket: LifeBuoy } as const;
const RECENT_ORDER_COLS = "md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_132px_88px]";

export default async function OverviewPage() {
  const user = await requireUser("/dashboard");
  const [data, catalog, recent] = await Promise.all([getOverview(), getCatalog(), listOrders({ status: "all", page: 1 })]);
  const now = clock();

  const states = data.services.map((s) => ({ service: s, state: serviceState(s, now) }));
  const active = states.filter(({ state }) => state.status === "active");
  const expiring = states.filter(({ state }) => state.expiringSoon);
  const healthy = active.length - expiring.length;
  const orderCount = data.orders.filter((o) => inProgress(o.status)).length;
  const awaitingPayment = data.orders.filter((o) => needsPayment(o.status)).length;
  const ticketCount = data.tickets.length;
  const awaitingReply = data.tickets.filter((t) => t.status === "awaiting_customer").length;
  const attention = attentionItems({ orders: data.orders, services: data.services, tickets: data.tickets }, now);
  const locationById = new Map(catalog.locations.map((l) => [l.id, l]));
  const name = firstName(user.profile.full_name, user.email);

  // Soonest-ending terms first, at most eight bars.
  const bars: TermBar[] = states.slice(0, 8).map(({ service, state }) => ({
    id: service.id,
    label: service.label,
    daysLeft: state.daysLeft,
    status: state.status === "expired" ? "expired" : state.status === "active" ? (state.expiringSoon ? "expiring" : "active") : "suspended",
    href: `/dashboard/services/${service.id}`,
    caption: `${state.status === "expired" ? "Expired" : "Expires"} ${formatDate(service.expires_at)}`,
  }));
  const nextExpiry = expiring[0];

  return (
    <>
      <PageHeader
        title={<Greeting name={name} />}
        description="Here's how your servers, orders and support look today."
        actions={
          <>
            <ButtonLink href="/dashboard/tickets/new" variant="secondary">
              Open a ticket
            </ButtonLink>
            <ButtonLink href="/order/new">New order</ButtonLink>
          </>
        }
      />

      <div className="space-y-4 sm:space-y-5">
        {/* Four headline numbers */}
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
          <StatCard
            tone="primary"
            icon={Server}
            label="Active servers"
            value={active.length}
            note={states.length === 0 ? "Order your first server" : `${plural(states.length, "server")} in your account`}
            href="/dashboard/services?filter=active"
          />
          <StatCard
            tone={expiring.length > 0 ? "warn" : "default"}
            icon={CalendarClock}
            label="Expiring in 7 days"
            value={expiring.length}
            note={nextExpiry ? `Next: ${nextExpiry.service.label}, ${formatDate(nextExpiry.service.expires_at)}` : "Nothing to renew right now"}
            href="/dashboard/services?filter=expiring"
          />
          <StatCard
            icon={ReceiptText}
            label="Orders in progress"
            value={orderCount}
            note={awaitingPayment > 0 ? `${awaitingPayment} waiting for payment` : orderCount > 0 ? "We're working on them" : "No open orders"}
            href="/dashboard/orders"
          />
          <StatCard
            icon={LifeBuoy}
            label="Open tickets"
            value={ticketCount}
            note={awaitingReply > 0 ? `${awaitingReply} waiting for your reply` : ticketCount > 0 ? "Our team is on it" : "No open requests"}
            href="/dashboard/tickets"
          />
        </div>

        {/* Things to do */}
        {attention.length > 0 && (
          <Card aria-labelledby="attention-heading">
            <CardHeader
              headingId="attention-heading"
              divided
              title="Needs your attention"
              description={`${plural(attention.length, "thing")} waiting on you`}
            />
            <RowList>
              {attention.map((a) => {
                const Icon = ATTENTION_ICON[a.kind];
                return (
                  <Row key={a.id} className="flex flex-wrap items-center gap-x-5">
                    <Icon size={20} strokeWidth={1.5} aria-hidden className="shrink-0 text-lav-600" />
                    <span className="min-w-0 flex-1 text-[15px] font-medium text-ink">{a.text}</span>
                    <ButtonLink href={a.href} variant={a.kind === "ticket" ? "secondary" : "primary"} size="sm">
                      {a.action}
                    </ButtonLink>
                  </Row>
                );
              })}
            </RowList>
          </Card>
        )}

        {/* Terms chart + health gauge */}
        <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card aria-labelledby="terms-heading">
            <CardHeader
              headingId="terms-heading"
              title="Server terms"
              description="Days left on each server, soonest first"
              action={<TermLegend />}
            />
            <div className="px-5 pb-6 sm:px-6">
              {bars.length > 0 ? (
                <TermChart bars={bars} />
              ) : (
                <EmptyState
                  bare
                  image="empty-services"
                  title="No servers yet"
                  body="Once an order is paid and delivered, each server's term shows up here."
                  action={<ButtonLink href="/order/new">Order your first server</ButtonLink>}
                />
              )}
            </div>
          </Card>

          <Card aria-labelledby="health-heading" className="flex flex-col">
            <CardHeader headingId="health-heading" title="Server health" description="Active and not due for renewal soon" />
            <div className="flex flex-1 flex-col justify-end gap-6 px-5 pb-6 sm:px-6">
              <HealthGauge
                empty={states.length === 0}
                percent={states.length === 0 ? 0 : (healthy / states.length) * 100}
                caption={states.length === 0 ? "No servers yet" : "of servers healthy"}
              />
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-card bg-surface-2 px-4 py-3.5">
                  <dt className="text-[13px] text-muted">Healthy</dt>
                  <dd className="num-tabular mt-1 font-display text-[24px] font-[500] leading-none tracking-[-0.025em] text-ink">{healthy}</dd>
                </div>
                <div className="rounded-card bg-surface-2 px-4 py-3.5">
                  <dt className="text-[13px] text-muted">Need attention</dt>
                  <dd className="num-tabular mt-1 font-display text-[24px] font-[500] leading-none tracking-[-0.025em] text-ink">
                    {states.length - healthy}
                  </dd>
                </div>
              </dl>
            </div>
          </Card>
        </div>

        {/* Servers */}
        <Card aria-labelledby="servers-heading">
          <CardHeader
            headingId="servers-heading"
            title="Your servers"
            description="Soonest-expiring first"
            action={states.length > 0 ? <CardLink href="/dashboard/services">View all</CardLink> : undefined}
          />
          {states.length === 0 ? (
            <EmptyState
              bare
              image="empty-services"
              title="No servers yet"
              body="Your servers appear here once an order is paid and delivered."
              action={<ButtonLink href="/order/new">Order your first server</ButtonLink>}
            />
          ) : (
            <>
              <ServiceTableHead />
              <RowList className="border-t border-line md:border-t-0">
                {states.slice(0, 6).map(({ service, state }) => (
                  <ServiceRow key={service.id} service={service} state={state} location={locationById.get(service.location_id)} />
                ))}
              </RowList>
            </>
          )}
        </Card>

        {/* Orders + activity */}
        <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card aria-labelledby="orders-heading">
            <CardHeader
              headingId="orders-heading"
              title="Recent orders"
              description="Your latest five"
              action={recent.items.length > 0 ? <CardLink href="/dashboard/orders">All orders</CardLink> : undefined}
            />
            {recent.items.length === 0 ? (
              <EmptyState
                bare
                image="empty-orders"
                title="No orders yet"
                body="When you place an order it shows up here, with its payment and delivery progress."
                action={<ButtonLink href="/order/new">Place your first order</ButtonLink>}
              />
            ) : (
              <>
                <TableHead className={RECENT_ORDER_COLS}>
                  <span>Order</span>
                  <span>Plan</span>
                  <span>Status</span>
                  <span className="text-right">Total</span>
                </TableHead>
                <RowList className="border-t border-line md:border-t-0">
                  {recent.items.slice(0, 5).map((o) => {
                    const loc = locationById.get(o.location_id);
                    return (
                      <Row key={o.id} className={RECENT_ORDER_COLS}>
                        <div className="min-w-0">
                          <Link href={`/dashboard/orders/${o.id}`} className="data-id text-[15px] font-semibold text-ink hover:text-lav-700">
                            {o.order_number}
                          </Link>
                          <p className="text-[12px] text-muted">
                            <LocalTime value={o.created_at} dateOnly />
                            {o.type === "renewal" && " · Renewal"}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-ink">{o.plan_name}</p>
                          {loc && (
                            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
                              <CountryFlag iso2={loc.iso2} />
                              {o.location_name}
                            </p>
                          )}
                        </div>
                        <div>
                          <StatusBadge kind="order" status={o.status} />
                        </div>
                        <p className="num-tabular text-[15px] font-medium text-ink md:text-right">{formatUsd(o.total_cents, { cents: true })}</p>
                      </Row>
                    );
                  })}
                </RowList>
              </>
            )}
          </Card>

          <Card aria-labelledby="activity-heading">
            <CardHeader
              headingId="activity-heading"
              title="Recent activity"
              action={data.notifications.length > 0 ? <CardLink href="/dashboard/notifications">All</CardLink> : undefined}
              divided
            />
            {data.notifications.length === 0 ? (
              <p className="px-5 py-10 text-center text-[14px] text-muted sm:px-6">You&apos;re all caught up. New updates will show here.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.notifications.slice(0, 5).map((n) => (
                  <NotificationItem key={n.id} n={n} now={now} />
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Help */}
        <Card padded className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <div>
            <h2 className="font-display text-[17px] font-semibold tracking-[-0.016em] text-ink">Connecting for the first time?</h2>
            <p className="mt-1 max-w-[60ch] text-[14px] leading-relaxed text-muted">
              Step-by-step guides for Windows, macOS, Android and iPhone are on the features page. Stuck? Open a ticket and
              our team will help.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/features#connect" variant="secondary">
              Connection guide
            </ButtonLink>
            <ButtonLink href="/dashboard/tickets/new" variant="secondary">
              Open a ticket
            </ButtonLink>
          </div>
        </Card>
      </div>
    </>
  );
}
