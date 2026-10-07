"use client";

import { useState, useTransition } from "react";
import { cancelOrder, refundOrder, startProvisioning } from "@/lib/admin/actions/orders";
import { centsToInput } from "@/lib/admin/money";
import { CANCEL_REASONS, REFUND_REASONS } from "@/lib/admin/reasons";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/utils";
import { ActionDialog } from "./action-dialog";

/** Cancel / refund for an order, and "mark as being set up". Each one restates the order and asks for a reason. */
export function OrderActions({
  orderId,
  orderNumber,
  status,
  type,
  totalCents,
}: {
  orderId: string;
  orderNumber: string;
  status: string;
  type: string;
  totalCents: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canCancel = ["awaiting_payment", "under_review", "rejected", "approved", "provisioning"].includes(status);
  const canRefund = ["approved", "provisioning", "completed"].includes(status);
  const canStart = type === "new" && status === "approved";

  return (
    <div className="space-y-3">
      {canStart && (
        <Button
          variant="secondary"
          className="w-full"
          loading={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await startProvisioning({ orderId });
              if (!r.ok) setError(r.message);
            })
          }
        >
          Mark as being set up
        </Button>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {canRefund && (
        <ActionDialog
          trigger={
            <Button variant="secondary" className="w-full">
              Record a refund
            </Button>
          }
          title={`Record a refund for ${orderNumber}?`}
          description="Refunds are paid outside this system (your bank or wallet). This records that one was made and marks the order as refunded."
          confirmLabel="Mark refunded"
          danger
          fields={[
            { kind: "text", name: "amount", label: "Amount refunded (USD)", defaultValue: centsToInput(totalCents), inputMode: "decimal", required: true, hint: `Up to ${formatUsd(totalCents, { cents: true })}.` },
            { kind: "select", name: "reason", label: "Reason", options: REFUND_REASONS, required: true },
            { kind: "text", name: "detail", label: "Details (optional)" },
          ]}
          onSubmit={(v) => refundOrder({ orderId, amount: v.amount ?? "", reason: v.reason as (typeof REFUND_REASONS)[number], detail: v.detail })}
        />
      )}
      {canCancel && (
        <ActionDialog
          trigger={
            <Button variant="secondary" className="w-full">
              Cancel order
            </Button>
          }
          title={`Cancel ${orderNumber}?`}
          description="Any pending payment proof is closed, a coupon is released, and the customer is told."
          confirmLabel="Cancel order"
          danger
          fields={[
            { kind: "select", name: "reason", label: "Reason", options: CANCEL_REASONS, required: true },
            { kind: "text", name: "detail", label: "Details (optional)" },
          ]}
          onSubmit={(v) => cancelOrder({ orderId, reason: v.reason as (typeof CANCEL_REASONS)[number], detail: v.detail })}
        />
      )}
      {!canCancel && !canRefund && !canStart && <p className="text-[13px] text-muted">No actions are available for this order.</p>}
    </div>
  );
}
