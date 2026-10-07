import { cn } from "@/lib/utils";

type Tone = "neutral" | "lavender" | "warn" | "bad" | "ok";

/** Status words as staff read them (the customer dashboard words the same states from the customer's side). */
const KINDS = {
  order: {
    awaiting_payment: ["Awaiting payment", "warn"],
    under_review: ["Under review", "lavender"],
    approved: ["Approved", "lavender"],
    provisioning: ["Setting up", "lavender"],
    completed: ["Completed", "ok"],
    rejected: ["Payment rejected", "bad"],
    cancelled: ["Cancelled", "bad"],
    refunded: ["Refunded", "neutral"],
  },
  payment: {
    pending: ["Pending", "lavender"],
    verified: ["Approved", "ok"],
    rejected: ["Rejected", "bad"],
  },
  service: {
    active: ["Active", "ok"],
    suspended: ["Suspended", "warn"],
    expired: ["Expired", "bad"],
    terminated: ["Terminated", "neutral"],
  },
  ticket: {
    open: ["Needs reply", "lavender"],
    awaiting_customer: ["Waiting on customer", "warn"],
    resolved: ["Resolved", "ok"],
    closed: ["Closed", "neutral"],
  },
  account: {
    active: ["Active", "ok"],
    suspended: ["Suspended", "warn"],
  },
  invoice: {
    paid: ["Paid", "ok"],
    void: ["Void", "neutral"],
  },
  inbox: {
    unread: ["Unread", "lavender"],
    handled: ["Handled", "ok"],
    spam: ["Spam", "neutral"],
  },
  priority: {
    low: ["Low", "neutral"],
    normal: ["Normal", "neutral"],
    high: ["High", "warn"],
    urgent: ["Urgent", "bad"],
  },
  stock: {
    in_stock: ["In stock", "ok"],
    low: ["Low", "warn"],
    out_of_stock: ["Out of stock", "bad"],
  },
  inventory: {
    available: ["Available", "ok"],
    allocated: ["Allocated", "lavender"],
    retired: ["Retired", "neutral"],
  },
} as const satisfies Record<string, Record<string, readonly [string, Tone]>>;

export type AdminStatusKind = keyof typeof KINDS;

const TONES: Record<Tone, string> = {
  neutral: "bg-bg text-ink-2",
  lavender: "bg-lav-100 text-lav-800",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad-ink",
  ok: "bg-ok-bg text-ok",
};

export function adminStatusLabel(kind: AdminStatusKind, status: string): string {
  return (KINDS[kind] as Record<string, readonly [string, Tone]>)[status]?.[0] ?? status.replace(/_/g, " ");
}

/** A soft-tinted 6px-radius badge with a small round dot (the same as the customer dashboard's). */
export function AdminBadge({ kind, status, className }: { kind: AdminStatusKind; status: string; className?: string }) {
  const entry = (KINDS[kind] as Record<string, readonly [string, Tone]>)[status];
  const label = entry?.[0] ?? status.replace(/_/g, " ");
  const tone = entry?.[1] ?? "neutral";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-badge px-2.5 py-1.5 text-[12px] font-medium leading-none", TONES[tone], className)}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
