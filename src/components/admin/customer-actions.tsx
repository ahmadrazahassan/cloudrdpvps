"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setCustomerStatus } from "@/lib/admin/actions/customers";
import { SUSPEND_REASONS } from "@/lib/admin/reasons";
import { ActionDialog } from "./action-dialog";

/** Suspend or restore a customer account. Suspending blocks new orders but keeps their servers and tickets. */
export function CustomerActions({ userId, name, status }: { userId: string; name: string; status: "active" | "suspended" }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status === "suspended") {
    return (
      <div className="space-y-2">
        <Button
          variant="secondary"
          className="w-full"
          loading={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await setCustomerStatus({ userId, status: "active" });
              if (!r.ok) setError(r.message);
            })
          }
        >
          Restore account
        </Button>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <ActionDialog
      trigger={
        <Button variant="secondary" className="w-full">
          Suspend account
        </Button>
      }
      title={`Suspend ${name}?`}
      description="They can't place new orders. Their servers keep running and they can still open support tickets. They are emailed the reason."
      confirmLabel="Suspend account"
      danger
      fields={[
        { kind: "select", name: "reason", label: "Reason", options: SUSPEND_REASONS, required: true },
        { kind: "text", name: "detail", label: "Details (optional)" },
      ]}
      onSubmit={(v) => setCustomerStatus({ userId, status: "suspended", reason: v.reason as (typeof SUSPEND_REASONS)[number], detail: v.detail })}
    />
  );
}
