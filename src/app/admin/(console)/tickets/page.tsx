import type { Metadata } from "next";
import Link from "next/link";
import { Ago, AdminHeader, CustomerLink, FilterBar, ResultCount } from "@/components/admin/parts";
import { DataTable, type Column } from "@/components/admin/data-table";
import { AdminBadge } from "@/components/admin/status";
import { Signal } from "@/components/ledger/primitives";
import { FilterLinks, Pagination, pageParam, param, withParams } from "@/components/portal/list-controls";
import { requireConsole } from "@/lib/admin/guard";
import { displayName } from "@/lib/admin/db";
import { isTicketView, listTickets, TICKET_VIEWS, type TicketView } from "@/lib/admin/queries";
import { now } from "@/lib/clock";
import type { Enums } from "@/types/database";

export const metadata: Metadata = { title: "Tickets" };

type Row = Awaited<ReturnType<typeof listTickets>>["items"][number];

const PRIORITIES: Enums<"ticket_priority">[] = ["low", "normal", "high", "urgent"];

/** How long a ticket has waited on staff, as a short chip: "2h", "3d". */
function waited(ms: number) {
  const h = ms / 3_600_000;
  return h < 1 ? `${Math.max(1, Math.round(ms / 60_000))}m` : h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`;
}

export default async function TicketsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireConsole();
  const sp = await searchParams;
  const viewParam = param(sp.view);
  const view: TicketView = isTicketView(viewParam) ? viewParam : "awaiting";
  const q = param(sp.q)?.slice(0, 64);
  const prio = PRIORITIES.find((p) => p === param(sp.priority));
  const page = pageParam(sp.page);
  const nowMs = now();

  const data = await listTickets({ view, me: user.id, priority: prio, q, page });
  const keep = { view: view === "awaiting" ? undefined : view, priority: prio, q };

  const columns: Column<Row>[] = [
    {
      key: "subject",
      header: "Ticket",
      cell: ({ ticket }) => (
        <Link href={`/admin/tickets/${ticket.id}`} data-row-link className="block min-w-0 hover:text-lav-700">
          <span className="block max-w-[360px] truncate font-semibold text-ink">{ticket.subject}</span>
          <span className="block text-[12px] font-normal text-muted">
            #{ticket.ticket_no} · {ticket.category.replace(/_/g, " ")}
          </span>
        </Link>
      ),
    },
    { key: "customer", header: "Customer", hide: "md", cell: ({ customer }) => <CustomerLink customer={customer} showEmail className="max-w-[220px]" /> },
    { key: "priority", header: "Priority", hide: "sm", cell: ({ ticket }) => (ticket.priority === "normal" ? <span className="text-muted">Normal</span> : <AdminBadge kind="priority" status={ticket.priority} />) },
    { key: "status", header: "Status", cell: ({ ticket }) => <AdminBadge kind="ticket" status={ticket.status} /> },
    {
      key: "wait",
      header: "Waiting",
      hide: "lg",
      cell: ({ ticket }) =>
        ticket.status === "open" ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
            <Signal tone={nowMs - Date.parse(ticket.last_message_at) > 4 * 3_600_000 ? "bad" : "warn"} />
            <span className="num-tabular">{waited(nowMs - Date.parse(ticket.last_message_at))}</span>
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    { key: "assignee", header: "Assigned", hide: "lg", cell: ({ assignee }) => <span className="text-ink-2">{assignee ? displayName(assignee) : <span className="text-muted">Unassigned</span>}</span> },
    { key: "last", header: "Last message", align: "right", cell: ({ ticket }) => <Ago value={ticket.last_message_at} nowMs={nowMs} className="text-muted" /> },
  ];

  return (
    <>
      <AdminHeader title="Tickets" description="Customer support requests, longest-waiting and most urgent first." />
      <FilterLinks label="Ticket view" current={view} hrefFor={(id) => withParams("/admin/tickets", { view: id === "awaiting" ? null : id, priority: prio, q })} items={TICKET_VIEWS.map((v) => ({ id: v.id, label: v.label }))} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          action="/admin/tickets"
          q={q}
          keep={{ view: keep.view }}
          placeholder="Subject, ticket number or customer"
          selects={[{ name: "priority", label: "Priority", all: "Any priority", value: prio, options: PRIORITIES.map((p) => ({ value: p, label: p[0]!.toUpperCase() + p.slice(1) })) }]}
        />
        <ResultCount total={data.total} noun="ticket" />
      </div>
      <div>
        <DataTable rows={data.items} columns={columns} rowKey={(r) => r.ticket.id} label="Tickets" empty="No tickets match." />
      </div>
      <Pagination page={data.page} pageCount={data.pageCount} hrefFor={(n) => withParams("/admin/tickets", { ...keep, page: n })} />
    </>
  );
}
