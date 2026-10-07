import type { Metadata } from "next";
import Link from "next/link";
import { Card, PagerBar, Row, RowList, SearchForm, Tabs } from "@/components/portal/cards";
import { EmptyState } from "@/components/portal/empty-state";
import { pageParam, param, withParams } from "@/components/portal/list-controls";
import { LocalTime } from "@/components/portal/local-time";
import { PageHeader } from "@/components/portal/page-header";
import { StatusBadge } from "@/components/portal/status-badge";
import { ButtonLink } from "@/components/ui/button";
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

      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <Tabs
          label="Filter tickets by status"
          items={TICKET_FILTERS}
          current={status}
          hrefFor={(id) => withParams(base, { status: id === "all" ? null : id, ...keep })}
        />
        <SearchForm
          action={base}
          id="ticket-search"
          label="Search tickets by subject"
          placeholder="Search subjects"
          defaultValue={q}
          keep={{ status: status === "all" ? null : status }}
        />
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
          <Card>
            <RowList>
              {items.map((t) => (
                <Row key={t.id} className="md:grid-cols-[minmax(0,1fr)_auto_auto] py-5">
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
                </Row>
              ))}
            </RowList>
            <PagerBar page={page} pageCount={pageCount} hrefFor={(p) => withParams(base, { status: status === "all" ? null : status, ...keep, page: p })} />
          </Card>
        </>
      )}
    </>
  );
}
