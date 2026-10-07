"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { placeOrder, previewCoupon } from "@/app/(marketing)/order/new/actions";
import { FormError, fieldError } from "@/components/auth/form-message";
import { ResendForm } from "@/components/auth/resend-form";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { Location, Plan, ProductType } from "@/content/catalog";
import { formatDate } from "@/lib/format";
import { formatUsd } from "@/lib/utils";
import type { Applied } from "./order-summary";

export interface RenewInfo {
  serviceId: string;
  label: string;
  planId: string;
  planName: string;
  locationId: string;
  locationName: string;
  iso2: string;
  product: ProductType;
  priceCents: number | null;
  expiresAt: string;
  /** False when the plan or location is no longer sold. */
  orderable: boolean;
}

export type SessionInfo =
  | { state: "guest" }
  | { state: "ready" | "unverified" | "suspended"; name: string; email: string; billingCountry: string | null };

/**
 * The last step, kept short: an optional coupon, the terms, and the button. Everything else about the order is already on
 * screen (the plan, the country, the summary), so it isn't repeated. The order is placed by the database, which recomputes the price.
 */
export function ReviewStep({
  session,
  plan,
  location,
  priceCents,
  orderable,
  renew,
  applied,
  onApplied,
  onChangePlan,
  reviewHref,
}: {
  session: Exclude<SessionInfo, { state: "guest" }>;
  plan?: Plan;
  location?: Location;
  priceCents: number | null;
  orderable: boolean;
  renew: RenewInfo | null;
  applied: Applied | null;
  onApplied: (a: Applied | null) => void;
  onChangePlan: () => void;
  /** This step's own address: what a confirmation email brings the customer back to. */
  reviewHref: string;
}) {
  const [state, formAction, pending] = useActionState(placeOrder, null);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponText, setCouponText] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();

  const couponRejected = Boolean(state && !state.ok && state.code === "COUPON_INVALID");
  const couponError = couponRejected && state && !state.ok ? [state.message] : fieldError(state, "coupon");

  if (!orderable) {
    return (
      <div role="alert" className="form-note" data-tone="error">
        {renew ? "This plan is no longer sold in this location, so it can't be renewed as it is. " : "That plan isn't available right now. "}
        {renew ? (
          <Link href="/order/new" className="font-semibold underline underline-offset-4">
            Choose a different plan
          </Link>
        ) : (
          <button type="button" onClick={onChangePlan} className="font-semibold underline underline-offset-4">
            Choose a different plan
          </button>
        )}
        .
      </div>
    );
  }

  if (session.state === "unverified") {
    return (
      <div className="max-w-[440px]">
        <p role="status" className="form-note" data-tone="error">
          Confirm your email address ({session.email}) before placing an order. We sent you a link — open it and you&apos;ll come back to this page.
        </p>
        <div className="mt-6">
          <ResendForm knownAddress email={session.email} next={reviewHref} />
        </div>
        <p className="mt-4 text-[13px] text-muted">
          Already confirmed?{" "}
          <ButtonLink href={reviewHref} variant="ghost" size="sm">
            Check again
          </ButtonLink>
        </p>
      </div>
    );
  }

  if (session.state === "suspended") {
    return (
      <p className="form-note" data-tone="error">
        Your account is suspended, so new orders are paused.{" "}
        <Link href="/dashboard/tickets/new" className="font-semibold underline underline-offset-4">
          Contact support
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={formAction} className="max-w-[440px] space-y-6" noValidate>
      <input type="hidden" name="planId" value={plan?.id ?? ""} />
      <input type="hidden" name="locationId" value={location?.id ?? ""} />
      <input type="hidden" name="renewServiceId" value={renew?.serviceId ?? ""} />
      {/* kept in the form even while its field is tucked away */}
      {!couponOpen && <input type="hidden" name="coupon" value="" />}

      {renew && (
        <p className="text-[14px] text-ink-2">
          Renewing “{renew.label}” — adds 30 days from {formatDate(renew.expiresAt)}.
        </p>
      )}

      {/* A rejected coupon is shown beside its field, not twice. */}
      <FormError state={couponRejected ? null : state} />
      {state && !state.ok && state.code === "TOO_MANY_OPEN_ORDERS" && (
        <p className="text-[14px]">
          <Link href="/dashboard/orders" className="text-link">
            Go to your orders
          </Link>
        </p>
      )}

      {couponOpen || couponRejected ? (
        <div>
          <div className="flex items-start gap-3">
            <Field
              className="min-w-0 flex-1"
              label="Coupon code"
              name="coupon"
              value={couponText}
              onChange={(e) => {
                setCouponText(e.target.value);
                onApplied(null);
                setCouponMsg(null);
              }}
              autoComplete="off"
              autoCapitalize="characters"
              autoFocus={couponOpen && !couponRejected}
              error={couponMsg ? [couponMsg] : couponError}
            />
            <Button
              type="button"
              variant="secondary"
              className="mt-[30px]"
              loading={checking}
              disabled={!couponText.trim() || !plan || !location}
              onClick={() =>
                startCheck(async () => {
                  setCouponMsg(null);
                  const r = await previewCoupon({ planId: plan!.id, locationId: location!.id, code: couponText });
                  if (r.ok) onApplied(r.data);
                  else {
                    onApplied(null);
                    setCouponMsg(r.fieldErrors?.code?.[0] ?? r.message);
                  }
                })
              }
            >
              Apply
            </Button>
          </div>
          {applied && (
            <p role="status" className="mt-2 text-[14px] text-ok">
              {applied.code.toUpperCase()} applied — you save {formatUsd(applied.discountCents, { cents: true })}.
            </p>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setCouponOpen(true)} className="text-link text-[14px]">
          Have a coupon code?
        </button>
      )}

      <div>
        <label className="check">
          <input type="checkbox" name="terms" aria-invalid={fieldError(state, "terms") ? true : undefined} />
          <span>
            I agree to the{" "}
            <Link href="/legal/terms" target="_blank" className="text-link">
              Terms of Service
            </Link>{" "}
            and the{" "}
            <Link href="/legal/acceptable-use" target="_blank" className="text-link">
              Acceptable Use Policy
            </Link>
            .
          </span>
        </label>
        {fieldError(state, "terms") && <p className="field-error">{fieldError(state, "terms")![0]}</p>}
      </div>

      <div>
        <Button type="submit" size="lg" loading={pending} className="w-full">
          Place order{priceCents !== null ? ` · ${formatUsd(applied ? applied.totalCents : priceCents, { cents: true })}` : ""}
        </Button>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">You&apos;ll pay on the next screen — nothing is charged by placing the order. Your server is delivered after we verify your payment.</p>
      </div>
    </form>
  );
}
