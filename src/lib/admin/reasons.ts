/** Reasons staff pick from instead of typing, so the audit log stays searchable. Shown to the customer where noted. */

export const REJECT_REASONS = [
  "Unreadable proof",
  "Amount mismatch",
  "Payment not received",
  "Reference not found",
  "Other",
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export const SUSPEND_REASONS = ["Abuse report", "Non-payment", "Security concern", "Customer request", "Other"] as const;
export const CANCEL_REASONS = ["Customer asked to cancel", "Duplicate order", "Fraud suspected", "Out of stock", "Other"] as const;
export const REFUND_REASONS = ["Server could not be delivered", "Customer request", "Duplicate payment", "Other"] as const;
export const EXTEND_REASONS = ["Goodwill credit", "Downtime compensation", "Payment received offline", "Migration", "Other"] as const;
