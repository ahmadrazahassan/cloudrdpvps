import {
  Bell,
  CalendarClock,
  Check,
  Clock,
  LifeBuoy,
  ReceiptText,
  Server,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { relativeTime } from "@/lib/format";
import type { Notification } from "@/lib/portal/queries";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  order_placed: ReceiptText,
  payment_under_review: Clock,
  payment_approved: Check,
  payment_rejected: X,
  service_delivered: Server,
  expiring_soon: CalendarClock,
  service_expired: CalendarClock,
  ticket_reply: LifeBuoy,
};

/** One notification row: bare icon, title, body, relative time. Unread ones are bold with a lavender dot. */
export function NotificationItem({ n, now }: { n: Notification; now?: number }) {
  const Icon = ICONS[n.type] ?? Bell;
  const unread = !n.read_at;
  const inner = (
    <>
      <Icon size={20} strokeWidth={1.5} aria-hidden className={cn("mt-0.5 shrink-0", unread ? "text-lav-600" : "text-muted")} />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[15px]", unread ? "font-semibold text-ink" : "font-medium text-ink-2")}>{n.title}</span>
        {n.body && <span className="mt-0.5 block text-[14px] leading-relaxed text-muted">{n.body}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2 pt-0.5 text-[12px] text-muted">
        <time dateTime={n.created_at}>{relativeTime(n.created_at, now)}</time>
        {unread && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-lav-600" />}
        {unread && <span className="sr-only">Unread</span>}
      </span>
    </>
  );

  const cls = "flex items-start gap-4 border-b border-line py-4";
  return (
    <li>
      {n.link ? (
        <Link href={n.link} className={cn(cls, "transition-colors hover:bg-black/[0.02]")}>
          {inner}
        </Link>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  );
}
