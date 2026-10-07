"use client";

import { Button } from "@/components/ui/button";
import { voidInvoice } from "@/lib/admin/actions/invoices";
import { ActionDialog } from "./action-dialog";

/** Void a paid invoice. It stays on record as "void" with the reason; nothing is deleted. */
export function VoidInvoice({ invoiceId, number }: { invoiceId: string; number: string }) {
  return (
    <ActionDialog
      trigger={
        <Button size="sm" variant="ghost">
          Void
        </Button>
      }
      title={`Void invoice ${number}?`}
      description="The invoice stays on record, marked void with your reason. This doesn't refund anything — record a refund on the order for that."
      confirmLabel="Void invoice"
      danger
      fields={[{ kind: "text", name: "reason", label: "Reason", required: true, placeholder: "e.g. Issued against the wrong billing details" }]}
      onSubmit={(v) => voidInvoice({ invoiceId, reason: v.reason ?? "" })}
    />
  );
}
