import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, LifeBuoy, ReceiptText } from "lucide-react";
import { EmptyState } from "@/components/portal/empty-state";
import { Greeting } from "@/components/portal/greeting";
import { NotificationItem } from "@/components/portal/notification-item";
import { Figure, LedgerSection } from "@/components/ledger/primitives";
import { PageHeader, Section } from "@/components/portal/page-header";
import { ServiceRow } from "@/components/portal/service-row";
import { ButtonLink } from "@/components/ui/button";
import { firstName } from "@/lib/format";
import { requireUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";
import { now as clock } from "@/lib/clock";
import { attentionItems, inProgress, serviceState } from "@/lib/portal/derive";
import { getOverview } from "@/lib/portal/queries";

export const metadata: Metadata = { title: "Overview" };

const ATTENTION_ICON = { pay: ReceiptText, renew: CalendarClock, ticket: LifeBuoy } as const;

export default async function OverviewPage() {
  const user = await requireUser("/dashboard");
  const [data, catalog] = await Promise.all([getOverview(), getCatalog()]);
  const now = clock();

  const states = data.services.map((s) => ({ service: s, state: serviceState(s, now) }));
  const active = states.filter(({ state }) => state.status === "active");
  const expiring = states.filter(({ state }) => state.expiringSoon);
  const orderCount = data.orders.filter((o) => inProgress(o.status)).length;
  const ticketCount = data.tickets.length;
  const attention = attentionItems({ orders: data.orders, services: data.services, tickets: data.tickets }, now);
  const locationById = new Map(catalog.locations.map((l) => [l.id, l]));
  const name = firstName(user.profile.full_name, user.email);

  const stats = [
    { label: "Active services", value: active.length, href: "/dashboard/services?filter=active" },
    { label: "Expiring in 7 days", value: expiring.length, href: "/dashboard/services?filter=expiring" },
    { label: "Orders in progress", value: orderCount, href: "/dashboard/orders" },
    { label: "Open tickets", value: ticketCount, href: "/dashboard/tickets" },
  ];

  return (
    <>
      <PageHeader
        title={<Greeting name={name} />}
        description="Your servers, orders and support in one place."
        actions={<ButtonLink href="/order/new">New order</ButtonLink>}
      />

      {/* Four figures split by hairlines */}
      <div className="grid grid-cols-2 divide-line border-y border-line lg:grid-cols-4 lg:divide-x [&>*]:border-b [&>*]:border-line lg:[&>*]:border-b-0">
        {stats.map((s) => (
          <Figure key={s.label} label={s.label} value={s.value} href={s.href} className="lg:first:pl-0" />
        ))}
      </div>

      <div className="mt-12 space-y-0">
        {attention.length > 0 && (
          <LedgerSection n={1} title="Needs your attention">
            <ul className="border-t border-line">
              {attention.map((a) => {
                const Icon = ATTENTION_ICON[a.kind];
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line py-4">
                    <Icon size={20} strokeWidth={1.5} aria-hidden className="shrink-0 text-lav-600" />
                    <span className="min-w-0 flex-1 text-[15px] font-medium text-ink">{a.text}</span>
                    <ButtonLink href={a.href} variant={a.kind === "ticket" ? "secondary" : "primary"} size="sm">
                      {a.action}
                    </ButtonLink>
                  </li>
                );
              })}
            </ul>
          </LedgerSection>
        )}

        <LedgerSection
          n={attention.length > 0 ? 2 : 1}
          title="Your services"
          aside={
            states.length > 0 ? (
              <Link href="/dashboard/services" className="text-link">
                View all
              </Link>
            ) : undefined
          }
        >
          {states.length === 0 ? (
            <EmptyState
              image="empty-services"
              title="No servers yet"
              body="Your servers appear here once an order is paid and delivered."
              action={<ButtonLink href="/order/new">Order your first server</ButtonLink>}
            />
          ) : (
            <ul className="border-t border-line">
              {states.slice(0, 6).map(({ service, state }) => (
                <ServiceRow key={service.id} service={service} state={state} location={locationById.get(service.location_id)} />
              ))}
            </ul>
          )}
        </LedgerSection>

        {data.notifications.length > 0 && (
          <LedgerSection
            n={attention.length > 0 ? 3 : 2}
            title="Recent activity"
            aside={
              <Link href="/dashboard/notifications" className="text-link">
                All notifications
              </Link>
            }
          >
            <ul className="border-t border-line">
              {data.notifications.map((n) => (
                <NotificationItem key={n.id} n={n} now={now} />
              ))}
            </ul>
          </LedgerSection>
        )}

        <Section>
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.014em] text-ink">Connecting for the first time?</h2>
              <p className="mt-1 max-w-[56ch] text-[14px] leading-relaxed text-muted">
                Step-by-step guides for Windows, macOS, Android and iPhone are on the features page. Stuck? Open a ticket
                and our team will help.
              </p>
            </div>
            <div className="flex gap-3">
              <ButtonLink href="/features#connect" variant="secondary">
                Connection guide
              </ButtonLink>
              <ButtonLink href="/dashboard/tickets/new" variant="secondary">
                Open a ticket
              </ButtonLink>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}
