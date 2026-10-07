"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setMessageStatus } from "@/lib/admin/actions/support";

/** Mark a contact-form message handled, spam, or unread again. */
export function InboxActions({ messageId, status }: { messageId: string; status: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = (next: "unread" | "handled" | "spam") =>
    start(async () => {
      setError(null);
      const r = await setMessageStatus({ messageId, status: next });
      if (!r.ok) setError(r.message);
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "handled" && (
        <Button size="sm" variant="secondary" loading={pending} onClick={() => set("handled")}>
          Mark handled
        </Button>
      )}
      {status !== "spam" && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => set("spam")}>
          Spam
        </Button>
      )}
      {status !== "unread" && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => set("unread")}>
          Mark unread
        </Button>
      )}
      {error && (
        <span role="alert" className="field-error !mt-0">
          {error}
        </span>
      )}
    </div>
  );
}
