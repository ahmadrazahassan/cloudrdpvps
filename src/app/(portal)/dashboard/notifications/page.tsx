import type { Metadata } from "next";
import { EmptyState } from "@/components/portal/empty-state";
import { Pagination, pageParam, withParams } from "@/components/portal/list-controls";
import { NotificationItem } from "@/components/portal/notification-item";
import { MarkAllReadButton } from "@/components/portal/notification-parts";
import { PageHeader } from "@/components/portal/page-header";
import { now as clock } from "@/lib/clock";
import { listNotifications } from "@/lib/portal/queries";

export const metadata: Metadata = { title: "Notifications" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function NotificationsPage({ searchParams }: Props) {
  const page = pageParam((await searchParams).page);
  const { items, pageCount } = await listNotifications(page);
  const unread = items.filter((n) => !n.read_at).length;
  const now = clock();

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Updates on your orders, payments, servers and tickets."
        actions={items.length > 0 ? <MarkAllReadButton disabled={unread === 0} /> : undefined}
      />

      {items.length === 0 ? (
        <EmptyState
          image="empty-notifications"
          title="You're all caught up"
          body="Order, payment, delivery and ticket updates will appear here."
        />
      ) : (
        <>
          <ul className="border-t border-line">
            {items.map((n) => (
              <NotificationItem key={n.id} n={n} now={now} />
            ))}
          </ul>
          <Pagination page={page} pageCount={pageCount} hrefFor={(p) => withParams("/dashboard/notifications", { page: p })} />
        </>
      )}
    </>
  );
}
