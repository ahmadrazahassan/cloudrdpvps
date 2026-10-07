import Link from "next/link";
import { Signal } from "@/components/ledger/primitives";
import { countdown } from "@/lib/format";
import type { ActionQueue } from "@/lib/admin/queries";

/**
 * The console's signature strip: one hairline row under the top bar that always shows what is waiting,
 * and how long the oldest payment has been waiting. Quiet (grey dot, "All clear") when nothing is.
 */
export function QueueRibbon({ queue, nowMs, isAdmin }: { queue: ActionQueue; nowMs: number; isAdmin: boolean }) {
  const oldest = queue.oldestPendingPaymentAt ? Math.max(0, nowMs - Date.parse(queue.oldestPendingPaymentAt)) : 0;
  const hours = oldest / 3_600_000;
  const waitText = oldest > 0 ? countdown(nowMs + oldest, nowMs) : null; // "3h 12m" (same formatter, forward-looking)

  const items = [
    isAdmin && { href: "/admin/payments", n: queue.paymentsToReview, label: "payments to review", tone: hours > 4 ? ("bad" as const) : hours > 1 ? ("warn" as const) : ("lav" as const), extra: waitText ? `oldest ${waitText}` : null },
    isAdmin && { href: "/admin/orders?view=allocate", n: queue.ordersToAllocate, label: "to allocate", tone: "lav" as const, extra: null },
    { href: "/admin/services?view=expiring", n: queue.expiring3d, label: "expiring ≤ 3 days", tone: "warn" as const, extra: null },
    { href: "/admin/tickets", n: queue.ticketsAwaitingStaff, label: "tickets need a reply", tone: "lav" as const, extra: null },
    { href: "/admin/inbox", n: queue.unreadInbox, label: "unread messages", tone: "lav" as const, extra: null },
  ].filter(Boolean) as { href: string; n: number; label: string; tone: "lav" | "warn" | "bad"; extra: string | null }[];

  const waiting = items.filter((i) => i.n > 0);

  return (
    <div className="border-b border-line px-4 sm:px-8 print:hidden" role="region" aria-label="Work waiting">
      <ul className="flex min-h-[40px] flex-wrap items-center gap-x-6 gap-y-1 py-2 text-[13px]">
        {waiting.length === 0 ? (
          <li className="flex items-center gap-2 text-muted">
            <Signal tone="ok" />
            All clear — nothing is waiting.
          </li>
        ) : (
          waiting.map((i) => (
            <li key={i.href}>
              <Link href={i.href} className="group inline-flex items-center gap-2 text-ink-2 transition-colors hover:text-ink">
                <Signal tone={i.tone} pulse={i.tone !== "lav"} />
                <span className="num-tabular font-semibold text-ink">{i.n}</span>
                <span>{i.label}</span>
                {i.extra && <span className="text-muted">· {i.extra}</span>}
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
