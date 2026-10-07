import type { Metadata } from "next";
import Link from "next/link";
import { Ago, AdminHeader } from "@/components/admin/parts";
import { InboxActions } from "@/components/admin/inbox-actions";
import { AdminBadge } from "@/components/admin/status";
import { Card } from "@/components/portal/cards";
import { FilterLinks, Pagination, pageParam, param, withParams } from "@/components/portal/list-controls";
import { requireConsole } from "@/lib/admin/guard";
import { listInbox, type InboxView } from "@/lib/admin/queries";
import { now } from "@/lib/clock";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Inbox" };

const VIEWS: { id: InboxView; label: string }[] = [
  { id: "unread", label: "Unread" },
  { id: "handled", label: "Handled" },
  { id: "spam", label: "Spam" },
  { id: "all", label: "All" },
];

export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireConsole();
  const sp = await searchParams;
  const view = VIEWS.find((v) => v.id === param(sp.view))?.id ?? "unread";
  const page = pageParam(sp.page);
  const nowMs = now();
  const data = await listInbox({ view, page });

  return (
    <>
      <AdminHeader title="Inbox" description="Messages from the public contact form. Reply by email, or open the customer if they have an account." />
      <FilterLinks label="Inbox view" current={view} hrefFor={(id) => withParams("/admin/inbox", { view: id === "unread" ? null : id })} items={VIEWS.map((v) => ({ id: v.id, label: v.label }))} />

      {data.items.length === 0 ? (
        <Card padded>
          <p className="py-8 text-center text-[14px] text-muted">{view === "unread" ? "No unread messages." : "No messages here."}</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {data.items.map(({ message: m, accountId }) => (
            <Card key={m.id} padded as="article">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[15px] font-semibold text-ink">{m.name}</span>
                <a href={`mailto:${m.email}`} className="text-[13.5px] text-lav-700 hover:text-lav-900">
                  {m.email}
                </a>
                {m.topic && <span className="label-caps !text-[11px]">{m.topic}</span>}
                <AdminBadge kind="inbox" status={m.status} />
                <time dateTime={m.created_at} title={`${formatDateTime(m.created_at)} UTC`} className="ml-auto text-[12.5px] text-muted">
                  <Ago value={m.created_at} nowMs={nowMs} />
                </time>
              </div>
              <p className="mt-3 max-w-[78ch] whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-ink">{m.message}</p>
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-4">
                <a
                  href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.topic ?? "your message"}`)}`}
                  className="btn btn-secondary btn-sm"
                >
                  Reply by email
                </a>
                {accountId && (
                  <Link href={`/admin/customers/${accountId}`} className="text-link text-[13.5px]">
                    Open customer
                  </Link>
                )}
                <InboxActions messageId={m.id} status={m.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
      <Pagination page={data.page} pageCount={data.pageCount} hrefFor={(n) => withParams("/admin/inbox", { view: view === "unread" ? null : view, page: n })} />
    </>
  );
}
