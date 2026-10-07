import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/portal/cards";
import { LocalTime } from "@/components/portal/local-time";
import { PageHeader } from "@/components/portal/page-header";
import { StatusBadge } from "@/components/portal/status-badge";
import { TicketLive, TicketReplyForm, TicketStatusButton } from "@/components/portal/ticket-parts";
import { now as clock } from "@/lib/clock";
import { getTicket, signedUrl, type TicketMessage } from "@/lib/portal/queries";
import { cn } from "@/lib/utils";
import { categoryLabel } from "../categories";

export const metadata: Metadata = { title: "Ticket" };

type Props = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Attachment {
  path: string;
  name: string;
  mime: string;
  size: number;
}

/** attachments is free-form jsonb: keep only entries shaped like what our own reply action writes. */
function attachmentsOf(m: TicketMessage): Attachment[] {
  if (!Array.isArray(m.attachments)) return [];
  return m.attachments.flatMap((a) => {
    const r = a as Record<string, unknown>;
    return typeof r?.path === "string" && typeof r?.name === "string" && r.path.startsWith(`${m.ticket_id}/`)
      ? [{ path: r.path, name: r.name, mime: typeof r.mime === "string" ? r.mime : "", size: typeof r.size === "number" ? r.size : 0 }]
      : [];
  });
}

export default async function TicketPage({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await getTicket(id);
  if (!data) notFound();
  const { ticket, messages, service } = data;

  // Signed links (5 minutes) for every attachment on the page, fetched in parallel.
  const links = new Map<string, string | null>();
  await Promise.all(
    messages.flatMap(attachmentsOf).map(async (a) => {
      links.set(a.path, await signedUrl("ticket-attachments", a.path, 300));
    }),
  );

  const sevenDays = 7 * 86_400_000;
  const reopenable =
    ticket.status !== "closed" || (ticket.closed_at !== null && clock() - new Date(ticket.closed_at).getTime() < sevenDays);
  const closedForGood = ticket.status === "closed" && !reopenable;

  return (
    <>
      <TicketLive ticketId={ticket.id} />
      <PageHeader
        title={ticket.subject}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="num-tabular">#{ticket.ticket_no}</span>
            <span>{categoryLabel(ticket.category)}</span>
            <StatusBadge kind="ticket" status={ticket.status} />
            {service && (
              <span>
                ·{" "}
                <Link href={`/dashboard/services/${service.id}`} className="text-link">
                  {service.label}
                </Link>
              </span>
            )}
          </span>
        }
        actions={!closedForGood ? <TicketStatusButton ticketId={ticket.id} current={ticket.status} /> : undefined}
      />

      <ol className="space-y-4" aria-label="Conversation">
        {messages.map((m) => {
          const staff = m.author_role !== "customer";
          return (
            <li key={m.id} className={cn("flex", staff ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "w-full max-w-[720px] rounded-panel border px-5 py-4 sm:px-6 sm:py-5",
                  staff ? "border-black/[0.06] bg-surface shadow-1" : "border-lav-200 bg-lav-50",
                )}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[14px] font-semibold text-ink">{staff ? "Support" : "You"}</span>
                  {staff && <span className="rounded-badge bg-lav-100 px-2 py-1 text-[11px] font-medium leading-none text-lav-800">Team</span>}
                  <span className="num-tabular text-[12px] text-muted">
                    <LocalTime value={m.created_at} />
                  </span>
                </div>
                <p className="mt-2.5 whitespace-pre-wrap break-words text-[15px] leading-[1.7] text-ink-2">{m.body}</p>
                {attachmentsOf(m).length > 0 && (
                  <ul className={cn("mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t pt-3", staff ? "border-line" : "border-lav-200")}>
                    {attachmentsOf(m).map((a) => {
                      const href = links.get(a.path);
                      return (
                        <li key={a.path} className="flex items-center gap-1.5 text-[13px]">
                          <FileText size={16} strokeWidth={1.5} aria-hidden className="text-muted" />
                          {href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-link">
                              {a.name}
                            </a>
                          ) : (
                            <span className="text-muted">{a.name}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <Card padded className="mt-6 max-w-[720px]">
        {closedForGood ? (
          <p className="text-[15px] text-ink-2">
            This ticket was closed a while ago.{" "}
            <Link href="/dashboard/tickets/new" className="text-link">
              Open a new ticket
            </Link>{" "}
            if you still need help.
          </p>
        ) : (
          <>
            <h2 className="mb-5 font-display text-[17px] font-semibold tracking-[-0.016em] text-ink">Reply</h2>
            <TicketReplyForm ticketId={ticket.id} />
          </>
        )}
      </Card>
    </>
  );
}
