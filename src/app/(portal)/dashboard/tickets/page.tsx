import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/portal/empty-state";
import { FilterLinks, Pagination, pageParam, param, withParams } from "@/components/portal/list-controls";
import { LocalTime } from "@/components/portal/local-time";
import { PageHeader } from "@/components/portal/page-header";
import { StatusBadge } from "@/components/portal/status-badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { listTickets, TICKET_FILTERS, type TicketFilter } from "@/lib/portal/queries";
import { categoryLabel } from "./categories";

export const metadata: Metadata = { title: "Support" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TicketsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = (TICKET_FILTERS.find((f) => f.id === param(sp.status))?.id ?? "all") as TicketFilter;
  const q = param(sp.q)?.slice(0, 80) ?? "";
  const page = pageParam(sp.page);
  const { items, total, pageCount } = await listTickets({ status, q, page });
  const base = "/dashboard/tickets";
  const keep = { q: q || null };

  return (
    <>
      <PageHeader
        title="Support"
        description="Talk to our team. We reply here and by email."
        actions={<ButtonLink href="/dashboard/tickets/new">New ticket</ButtonLink>}
      />

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 flex-1">
          <FilterLinks
            label="Filter tickets by status"
            items={TICKET_FILTERS}
            current={status}
            hrefFor={(id) => withParams(base, { status: id === "all" ? null : id, ...keep })}
          />
        </div>
        <form method="get" action={base} role="search" className="flex items-center gap-2 pb-2">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <label htmlFor="ticket-search" className="sr-only">
            Search tickets by subject
          </label>
          <div className="relative">
            <Search size={16} strokeWidth={1.5} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="ticket-search"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search subjects"
              autoComplete="off"
              className="field-input !h-10 !w-[220px] !pl-9 !text-[14px]"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {items.length === 0 ? (
        status === "all" && !q ? (
          <EmptyState
            image="empty-tickets"
            title="No tickets yet"
            body="Need a restart, a reinstall or a hand connecting? Open a ticket and our team will help."
            action={<ButtonLink href="/dashboard/tickets/new">Open a ticket</ButtonLink>}
          />
        ) : (
          <EmptyState
            image="empty-search"
            title="No tickets match"
            body="Try a different filter or search term."
            action={
              <ButtonLink href={base} variant="secondary">
                Clear filters
              </ButtonLink>
            }
          />
        )
      ) : (
        <>
          <p role="status" className="sr-only">
            {total} {total === 1 ? "ticket" : "tickets"}
          </p>
          <ul>
            {items.map((t) => (
              <li key={t.id} className="grid gap-x-6 gap-y-2 border-b border-line py-5 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                <div className="min-w-0">
                  <Link href={`/dashboard/tickets/${t.id}`} className="block truncate text-[16px] font-semibold text-ink hover:text-lav-700">
                    {t.subject}
                  </Link>
                  <p className="mt-0.5 text-[13px] text-muted">
                    <span className="num-tabular">#{t.ticket_no}</span> · {categoryLabel(t.category)}
                  </p>
                </div>
                <p className="text-[13px] text-muted">
                  Updated <LocalTime value={t.last_message_at} dateOnly />
                </p>
                <div>
                  <StatusBadge kind="ticket" status={t.status} />
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageCount={pageCount} hrefFor={(p) => withParams(base, { status: status === "all" ? null : status, ...keep, page: p })} />
        </>
      )}
    </>
  );
}
