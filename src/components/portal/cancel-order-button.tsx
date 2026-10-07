"use client";

import { useRouter } from "next/navigation";
import { cancelOrder } from "@/app/(portal)/dashboard/orders/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";

export function CancelOrderButton({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={<Button variant="secondary">Cancel order</Button>}
      title={`Cancel order ${orderNumber}?`}
      description="The order will be cancelled and any coupon on it released. You haven't been charged, so there is nothing to refund. You can place a new order any time."
      confirmLabel="Cancel order"
      cancelLabel="Keep order"
      onConfirm={async () => {
        const result = await cancelOrder({ orderId });
        if (result.ok) router.push("/dashboard/orders");
        return result;
      }}
    />
  );
}
