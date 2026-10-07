import { cn } from "@/lib/utils";

type Tone = "neutral" | "lavender" | "warn" | "bad" | "ok";

const ORDER: Record<string, { label: string; tone: Tone }> = {
  awaiting_payment: { label: "Awaiting payment", tone: "warn" },
  under_review: { label: "Under review", tone: "lavender" },
  approved: { label: "Approved", tone: "lavender" },
  provisioning: { label: "Being set up", tone: "lavender" },
  completed: { label: "Completed", tone: "ok" },
  rejected: { label: "Payment rejected", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "bad" },
  refunded: { label: "Refunded", tone: "neutral" },
};
const PAYMENT: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Pending review", tone: "lavender" },
  verified: { label: "Verified", tone: "ok" },
  rejected: { label: "Rejected", tone: "bad" },
};
const SERVICE: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "ok" },
  suspended: { label: "Suspended", tone: "warn" },
  expired: { label: "Expired", tone: "bad" },
  terminated: { label: "Terminated", tone: "neutral" },
};
const TICKET: Record<string, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "lavender" },
  awaiting_customer: { label: "Awaiting your reply", tone: "warn" },
  resolved: { label: "Resolved", tone: "ok" },
  closed: { label: "Closed", tone: "neutral" },
};

const TABLES = { order: ORDER, payment: PAYMENT, service: SERVICE, ticket: TICKET } as const;

const TONES: Record<Tone, string> = {
  neutral: "bg-bg text-ink-2",
  lavender: "bg-lav-100 text-lav-800",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad-ink",
  ok: "bg-ok-bg text-ok",
};

export function statusLabel(kind: keyof typeof TABLES, status: string) {
  return TABLES[kind][status]?.label ?? status.replace(/_/g, " ");
}

/** A soft-tinted 6px-radius badge with a small round dot. The tint is the status colour at ~10%; the text keeps AA contrast on it. */
export function StatusBadge({
  kind,
  status,
  className,
}: {
  kind: keyof typeof TABLES;
  status: string;
  className?: string;
}) {
  const entry = TABLES[kind][status] ?? { label: status.replace(/_/g, " "), tone: "neutral" as Tone };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-badge px-2.5 py-1.5 text-[12px] font-medium leading-none",
        TONES[entry.tone],
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {entry.label}
    </span>
  );
}
