import type { Enums } from "@/types/database";

/**
 * Pure helpers that turn database rows into what the portal shows. They take
 * "now" as a parameter so they can be tested without a clock.
 */

type ServiceStatus = Enums<"service_status">;
type OrderStatus = Enums<"order_status">;

const DAY = 86_400_000;

/** A service whose expiry has passed is "expired" even before the nightly job flips the column. */
export function serviceState(
  s: { status: ServiceStatus; expires_at: string },
  now: number = Date.now(),
): { status: ServiceStatus; daysLeft: number; expiringSoon: boolean } {
  const exp = new Date(s.expires_at).getTime();
  const status: ServiceStatus = s.status === "active" && exp < now ? "expired" : s.status;
  const daysLeft = Math.max(0, Math.ceil((exp - now) / DAY));
  return { status, daysLeft, expiringSoon: status === "active" && daysLeft <= 7 };
}

/** Can the owner still see login details? Mirrors get_service_credentials in the database. */
export const credentialsAvailable = (s: { status: ServiceStatus; expires_at: string }, now: number = Date.now()) =>
  serviceState(s, now).status === "active";

/** Order states in which the customer still needs to do something about payment. */
export const needsPayment = (status: OrderStatus) => status === "awaiting_payment" || status === "rejected";
/** Order states that are still moving through our process. */
export const inProgress = (status: OrderStatus) =>
  status === "awaiting_payment" || status === "under_review" || status === "approved" || status === "provisioning";

export interface OrderEventLike {
  id: number;
  event: string;
  to_status: OrderStatus | null;
  created_at: string;
  data?: unknown;
}

export interface TimelineStep {
  id: string;
  title: string;
  at: string | null;
  detail?: string;
  tone: "default" | "ok" | "bad" | "pending";
}

/**
 * The customer-facing timeline: Order placed → Payment submitted → Payment verified →
 * Server delivered. Steps already reached carry their timestamp; steps ahead are shown
 * as pending. Terminal states (rejected, cancelled, refunded) replace the steps ahead.
 */
export function orderTimeline(
  order: { status: OrderStatus; created_at: string; cancelled_at: string | null },
  events: OrderEventLike[],
  rejectMessage?: string | null,
): TimelineStep[] {
  const firstAt = (pred: (e: OrderEventLike) => boolean) => events.find(pred)?.created_at ?? null;
  const lastAt = (pred: (e: OrderEventLike) => boolean) => [...events].reverse().find(pred)?.created_at ?? null;

  const placed = firstAt((e) => e.event === "created") ?? order.created_at;
  const submitted = firstAt((e) => e.event === "payment_submitted");
  const verified = lastAt((e) => e.to_status === "approved");
  const delivered = lastAt((e) => e.to_status === "completed");

  const steps: TimelineStep[] = [
    { id: "placed", title: "Order placed", at: placed, tone: "default" },
    { id: "submitted", title: "Payment submitted", at: submitted, tone: submitted ? "default" : "pending" },
  ];

  const rejectedAt = lastAt((e) => e.to_status === "rejected");
  if (order.status === "rejected") {
    steps.push({
      id: "rejected",
      title: "Payment rejected",
      at: rejectedAt,
      detail: rejectMessage ?? "We couldn't verify your payment. You can submit new proof.",
      tone: "bad",
    });
    return steps;
  }
  if (order.status === "cancelled") {
    steps.push({ id: "cancelled", title: "Order cancelled", at: order.cancelled_at, tone: "bad" });
    return steps;
  }

  steps.push({ id: "verified", title: "Payment verified", at: verified, tone: verified ? "default" : "pending" });
  steps.push({
    id: "delivered",
    title: "Server delivered",
    at: delivered,
    tone: order.status === "completed" ? "ok" : "pending",
  });
  if (order.status === "refunded") {
    steps.push({ id: "refunded", title: "Refunded", at: lastAt((e) => e.to_status === "refunded"), tone: "bad" });
  }
  return steps;
}

export type TrackerState = "done" | "current" | "todo" | "bad";
export interface TrackerStep {
  id: "placed" | "payment" | "verified" | "setup" | "delivered" | "renewed" | "rejected" | "cancelled" | "refunded";
  label: string;
  state: TrackerState;
  at: string | null;
  /** Shown instead of a date while the step has none (what is happening now, or "Pending"). */
  hint: string;
}

/**
 * The order tracker: Placed → Payment → Verified → Setup → Delivered (a renewal has no setup, so it ends at
 * "Renewed"). Every step is done, the current one, or still ahead; a rejected payment, a cancellation and a
 * refund are drawn as a red step. The dates come from the order's event log.
 */
export function orderTracker(
  order: { status: OrderStatus; type: "new" | "renewal"; created_at: string; cancelled_at: string | null },
  events: OrderEventLike[],
): TrackerStep[] {
  const firstAt = (pred: (e: OrderEventLike) => boolean) => events.find(pred)?.created_at ?? null;
  const lastAt = (pred: (e: OrderEventLike) => boolean) => [...events].reverse().find(pred)?.created_at ?? null;

  const submittedAt = firstAt((e) => e.event === "payment_submitted");
  const verifiedAt = lastAt((e) => e.event === "payment_approved" || e.to_status === "approved");
  const setupAt = firstAt((e) => e.event === "provisioning_started");
  const deliveredAt = lastAt((e) => e.to_status === "completed");
  const s = order.status;
  const renewal = order.type === "renewal";

  const step = (id: TrackerStep["id"], label: string, state: TrackerState, at: string | null, hint = state === "todo" ? "Pending" : ""): TrackerStep => ({
    id,
    label,
    state,
    at,
    hint,
  });
  const placed = step("placed", "Placed", "done", firstAt((e) => e.event === "created") ?? order.created_at);

  if (s === "rejected") {
    return [placed, step("rejected", "Rejected", "bad", lastAt((e) => e.to_status === "rejected"), "Submit new proof"), ...ahead(renewal)];
  }
  if (s === "cancelled") {
    return [
      placed,
      step("payment", "Payment", submittedAt ? "done" : "todo", submittedAt),
      step("cancelled", "Cancelled", "bad", order.cancelled_at),
    ];
  }

  const paid = s !== "awaiting_payment";
  const verified = s === "approved" || s === "provisioning" || s === "completed" || s === "refunded";
  const delivered = s === "completed" || (s === "refunded" && deliveredAt !== null);
  const settingUp = s === "approved" || s === "provisioning";
  const setupState: TrackerState = delivered || (s === "refunded" && setupAt !== null) ? "done" : settingUp ? "current" : "todo";
  const tail: TrackerStep[] = renewal
    ? [step("renewed", "Renewed", delivered ? "done" : "todo", deliveredAt)]
    : [
        step("setup", "Setup", setupState, setupAt, settingUp ? "In progress" : undefined),
        step("delivered", "Delivered", delivered ? "done" : "todo", deliveredAt),
      ];

  const steps = [
    placed,
    step("payment", "Payment", paid ? "done" : "current", submittedAt, paid ? "" : "Waiting for payment"),
    step("verified", "Verified", verified ? "done" : s === "under_review" ? "current" : "todo", verifiedAt, s === "under_review" ? "Being checked" : undefined),
    ...tail,
  ];
  if (s === "refunded") steps.push(step("refunded", "Refunded", "bad", lastAt((e) => e.to_status === "refunded")));
  return steps;
}

/** The steps still ahead after a rejected payment. */
function ahead(renewal: boolean): TrackerStep[] {
  const todo = (id: TrackerStep["id"], label: string): TrackerStep => ({ id, label, state: "todo", at: null, hint: "Pending" });
  return renewal
    ? [todo("verified", "Verified"), todo("renewed", "Renewed")]
    : [todo("verified", "Verified"), todo("setup", "Setup"), todo("delivered", "Delivered")];
}

export interface AttentionItem {
  id: string;
  kind: "pay" | "renew" | "ticket";
  text: string;
  href: string;
  action: string;
}

/** "Needs your attention" for the overview, most urgent first. */
export function attentionItems(
  input: {
    orders: { id: string; order_number: string; status: OrderStatus; expires_at: string }[];
    services: { id: string; label: string; status: ServiceStatus; expires_at: string }[];
    tickets: { id: string; ticket_no: number; status: Enums<"ticket_status"> }[];
  },
  now: number = Date.now(),
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const o of input.orders) {
    if (o.status === "awaiting_payment" && new Date(o.expires_at).getTime() > now) {
      items.push({ id: `o-${o.id}`, kind: "pay", text: `Pay for order ${o.order_number}`, href: `/dashboard/orders/${o.id}/pay`, action: "Pay now" });
    } else if (o.status === "rejected") {
      items.push({ id: `o-${o.id}`, kind: "pay", text: `Payment for ${o.order_number} was rejected`, href: `/dashboard/orders/${o.id}/pay`, action: "Submit new proof" });
    }
  }

  const soon = input.services
    .map((s) => ({ s, st: serviceState(s, now) }))
    .filter(({ st }) => st.expiringSoon || st.status === "expired")
    .sort((a, b) => a.st.daysLeft - b.st.daysLeft);
  for (const { s, st } of soon) {
    items.push({
      id: `s-${s.id}`,
      kind: "renew",
      text:
        st.status === "expired"
          ? `“${s.label}” has expired`
          : `Renew “${s.label}” — expires in ${st.daysLeft} ${st.daysLeft === 1 ? "day" : "days"}`,
      href: `/order/new?renew=${s.id}`,
      action: "Renew",
    });
  }

  for (const t of input.tickets) {
    if (t.status === "awaiting_customer") {
      items.push({ id: `t-${t.id}`, kind: "ticket", text: `Reply on ticket #${t.ticket_no}`, href: `/dashboard/tickets/${t.id}`, action: "Open" });
    }
  }
  return items;
}
