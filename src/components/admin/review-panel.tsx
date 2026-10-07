"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { approvePayment, rejectPayment } from "@/lib/admin/actions/payments";
import { centsToInput, parseUsdToCents } from "@/lib/admin/money";
import { REJECT_REASONS } from "@/lib/admin/reasons";
import { Kbd } from "@/components/ledger/primitives";
import { ConfirmDialog } from "@/components/portal/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatUsd } from "@/lib/utils";
import { ActionDialog } from "./action-dialog";

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");

/**
 * Approve / reject for one payment. Approving needs the amount received; if it is less than the order
 * total the approve button is off and the form says why (the database refuses it too). A new order jumps
 * straight to its "Deliver server" panel after approval, so proof → server is one continuous flow.
 * Keyboard: A approve, R reject.
 */
export function ReviewPanel({
  paymentId,
  orderNumber,
  orderType,
  expectedCents,
}: {
  paymentId: string;
  orderNumber: string;
  orderType: "new" | "renewal";
  expectedCents: number;
}) {
  const router = useRouter();
  const [received, setReceived] = useState(centsToInput(expectedCents));
  const approveRef = useRef<HTMLButtonElement>(null);
  const rejectRef = useRef<HTMLButtonElement>(null);

  const cents = parseUsdToCents(received);
  const short = cents !== null && cents < expectedCents;
  const invalid = cents === null || cents <= 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector("[role='dialog']")) return;
      if (e.key === "a" || e.key === "A") {
        if (!approveRef.current?.disabled) {
          e.preventDefault();
          approveRef.current?.click();
        }
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        rejectRef.current?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="space-y-5">
      <Field
        label="Amount received (USD)"
        name="received"
        inputMode="decimal"
        autoComplete="off"
        value={received}
        onChange={(e) => setReceived(e.target.value)}
        hint={`Expected ${formatUsd(expectedCents, { cents: true })}. Check your bank or wallet, not just the screenshot.`}
        error={invalid ? ["Enter an amount like 25.00."] : undefined}
      />

      {short && (
        <p role="alert" className="form-note flex items-start gap-2" data-tone="error">
          <TriangleAlert size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            That is {formatUsd(expectedCents - (cents ?? 0), { cents: true })} short of the order total, so it can&apos;t be approved. Reject it with the “Amount mismatch” reason and the customer can pay the rest.
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <ConfirmDialog
          danger={false}
          trigger={
            <Button ref={approveRef} disabled={invalid || short}>
              Approve payment <Kbd className="border-white/40 text-white/80">A</Kbd>
            </Button>
          }
          title={`Approve ${formatUsd(cents ?? 0, { cents: true })} for ${orderNumber}?`}
          description={
            orderType === "renewal"
              ? "The invoice is issued, the server is extended and the customer is notified."
              : "The invoice is issued and the customer is notified. You can deliver the server straight after."
          }
          confirmLabel="Approve payment"
          cancelLabel="Not yet"
          onConfirm={async () => {
            const result = await approvePayment({ paymentId, received });
            if (result.ok && result.data.type === "new") router.push(`/admin/orders/${result.data.orderId}?deliver=1`);
            return result;
          }}
        />

        <ActionDialog
          danger
          trigger={
            <Button ref={rejectRef} variant="secondary">
              Reject <Kbd>R</Kbd>
            </Button>
          }
          title={`Reject the payment for ${orderNumber}?`}
          description="The customer is told why and gets 24 more hours to pay. This can't be undone."
          confirmLabel="Reject payment"
          fields={[
            { kind: "select", name: "reason", label: "Reason", options: REJECT_REASONS, required: true, defaultValue: short ? "Amount mismatch" : "" },
            { kind: "textarea", name: "message", label: "Message to the customer (optional)", placeholder: "e.g. The transfer reference doesn't appear in our account." },
          ]}
          onSubmit={(v) => rejectPayment({ paymentId, reason: v.reason as (typeof REJECT_REASONS)[number], message: v.message })}
        />
      </div>
    </div>
  );
}
