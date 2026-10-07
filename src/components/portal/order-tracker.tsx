import { Ban, CalendarCheck, CircleX, MonitorCheck, ReceiptText, Server, ShieldCheck, Undo2, Wallet, type LucideIcon } from "lucide-react";
import { OrderSteps, type OrderStep } from "@/components/shared/order-steps";
import type { TrackerStep } from "@/lib/portal/derive";
import { LocalTime } from "./local-time";

const ICONS: Record<TrackerStep["id"], LucideIcon> = {
  placed: ReceiptText,
  payment: Wallet,
  verified: ShieldCheck,
  setup: Server,
  delivered: MonitorCheck,
  renewed: CalendarCheck,
  rejected: CircleX,
  cancelled: Ban,
  refunded: Undo2,
};

/** "Track your order": where an order is right now, with the date each step was reached. */
export function OrderTracker({ steps, className }: { steps: TrackerStep[]; className?: string }) {
  const items: OrderStep[] = steps.map((s) => ({
    id: s.id,
    label: s.label,
    icon: ICONS[s.id],
    state: s.state,
    meta: s.at ? <LocalTime value={s.at} dateOnly /> : s.hint || (s.state === "done" ? "Done" : undefined),
  }));
  return <OrderSteps label="Order progress" steps={items} className={className} surface="card" />;
}
