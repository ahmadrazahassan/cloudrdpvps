/**
 * One vocabulary of failures, shared by the database (which raises these as the
 * message of a P0001 exception), server actions and the UI. Copy here is safe to
 * show to customers; it never echoes database internals.
 */
export const ERROR_CODES = [
  // generic
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "CONFLICT",
  "RATE_LIMITED",
  "CAPTCHA_FAILED",
  "UNAVAILABLE",
  "INTERNAL",
  // account
  "INVALID_CREDENTIALS",
  "EMAIL_NOT_CONFIRMED",
  "LINK_INVALID",
  "ACCOUNT_SUSPENDED",
  "EMAIL_NOT_VERIFIED",
  "LAST_ADMIN",
  // ordering
  "MAINTENANCE",
  "TOO_MANY_OPEN_ORDERS",
  "RENEWAL_PENDING",
  "PLAN_UNAVAILABLE",
  "OUT_OF_STOCK",
  "COUPON_INVALID",
  "ORDER_EXPIRED",
  // payments
  "UPLOAD_INVALID",
  "REFERENCE_REQUIRED",
  "AMOUNT_MISMATCH",
  // services / support / admin
  "SERVICE_NOT_ACTIVE",
  "SERVICE_TERMINATED",
  "REASON_REQUIRED",
  "TICKET_CLOSED",
  "AUDIT_IMMUTABLE",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Please sign in to continue.",
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find that.",
  VALIDATION: "Some details are invalid. Please check them and try again.",
  CONFLICT: "That isn't possible right now because the item has changed. Refresh and try again.",
  RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
  CAPTCHA_FAILED: "We couldn't verify you're human. Please try again.",
  UNAVAILABLE: "This isn't available in this environment yet.",
  INTERNAL: "Something went wrong on our side. Please try again.",
  INVALID_CREDENTIALS: "Incorrect email or password.",
  EMAIL_NOT_CONFIRMED: "Confirm your email address first. Check your inbox for the link, or request a new one.",
  LINK_INVALID: "That link is invalid or has expired. Request a new one.",
  ACCOUNT_SUSPENDED: "Your account is suspended. Contact support for help.",
  EMAIL_NOT_VERIFIED: "Verify your email address before placing an order.",
  LAST_ADMIN: "You can't remove the last active admin.",
  MAINTENANCE: "Ordering is paused for maintenance. Please try again shortly.",
  TOO_MANY_OPEN_ORDERS: "You have too many unpaid orders. Pay or cancel one first.",
  RENEWAL_PENDING: "This server already has a renewal awaiting payment.",
  PLAN_UNAVAILABLE: "That plan is no longer available in this location.",
  OUT_OF_STOCK: "That plan is out of stock in this location.",
  COUPON_INVALID: "That coupon can't be applied to this order.",
  ORDER_EXPIRED: "This order has expired. Please place a new order.",
  UPLOAD_INVALID: "That file can't be used. Upload a PNG, JPG, WebP or PDF under 5 MB.",
  REFERENCE_REQUIRED: "Enter the transaction reference for this payment method.",
  AMOUNT_MISMATCH: "The amount received doesn't cover the order total.",
  SERVICE_NOT_ACTIVE: "This server isn't active. Renew it to see its login details.",
  SERVICE_TERMINATED: "This server has been terminated.",
  REASON_REQUIRED: "A reason is required for this action.",
  TICKET_CLOSED: "This ticket was closed a while ago. Please open a new one.",
  AUDIT_IMMUTABLE: "Audit records can't be changed.",
};

export class AppError extends Error {
  readonly code: ErrorCode;
  /** Per-field messages, for VALIDATION errors found after zod (e.g. by Supabase Auth). */
  readonly fieldErrors?: Record<string, string[]>;
  constructor(
    code: ErrorCode,
    message?: string,
    options?: { cause?: unknown; fieldErrors?: Record<string, string[]> },
  ) {
    super(message ?? ERROR_MESSAGES[code], options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = options?.fieldErrors;
  }
}

const CODE_SET: ReadonlySet<string> = new Set(ERROR_CODES);
export const isErrorCode = (value: unknown): value is ErrorCode => typeof value === "string" && CODE_SET.has(value);

interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
}

/**
 * Translate a PostgREST / Postgres error into one of our codes.
 *  - P0001 + a known code as the message  -> that code (raised by our RPCs)
 *  - 42501 (privilege / RLS)              -> FORBIDDEN
 *  - 23505 unique violation               -> CONFLICT
 *  - 23514/23502/23503/22P02/22001/22023  -> VALIDATION (bad input that slipped past the app layer)
 *  - PGRST116 (no row)                    -> NOT_FOUND
 *  - PGRST301/PGRST303 (bad/expired JWT)  -> UNAUTHENTICATED
 * Anything else is INTERNAL; the raw text is only ever logged, never returned.
 */
export function fromDbError(error: PostgrestLikeError): AppError {
  const { code, message } = error;
  if (code === "P0001" && isErrorCode(message)) return new AppError(message);
  switch (code) {
    case "42501":
      return new AppError("FORBIDDEN");
    case "23505":
      return new AppError("CONFLICT");
    case "23514":
    case "23502":
    case "23503":
    case "22P02":
    case "22001":
    case "22023":
      return new AppError("VALIDATION");
    case "PGRST116":
      return new AppError("NOT_FOUND");
    case "PGRST301":
    case "PGRST303":
      return new AppError("UNAUTHENTICATED");
    default:
      return new AppError("INTERNAL", ERROR_MESSAGES.INTERNAL, { cause: error });
  }
}

/** Throw if a Supabase call returned an error; otherwise hand back the data. */
export function unwrap<T>(result: { data: T | null; error: PostgrestLikeError | null }): T {
  if (result.error) throw fromDbError(result.error);
  if (result.data === null) throw new AppError("NOT_FOUND");
  return result.data;
}

/** Like `unwrap`, for calls that legitimately return nothing (void RPCs, deletes). */
export function check(result: { error: PostgrestLikeError | null }): void {
  if (result.error) throw fromDbError(result.error);
}
