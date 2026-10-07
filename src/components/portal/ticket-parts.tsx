"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { replyToTicket, setTicketStatus } from "@/app/(portal)/dashboard/tickets/actions";
import { FormError, fieldError } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { TextareaField } from "@/components/ui/field";
import { getBrowserClient } from "@/lib/supabase/browser";
import { FileDropzone } from "./file-dropzone";

/**
 * Refreshes the thread the moment staff reply or the status changes. Realtime is filtered by row-level
 * security, so this only ever hears about the signed-in customer's own ticket.
 */
export function TicketLive({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`ticket:${ticketId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${ticketId}` }, () =>
        router.refresh(),
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tickets", filter: `id=eq.${ticketId}` }, () => router.refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ticketId, router]);
  return null;
}

export function TicketReplyForm({ ticketId, disabled }: { ticketId: string; disabled?: boolean }) {
  const [formKey, setFormKey] = useState(0);
  // After a successful send, start with an empty form (including the file list): bumping the key remounts it.
  const [state, formAction, pending] = useActionState(async (previous: Parameters<typeof replyToTicket>[0], data: FormData) => {
    const result = await replyToTicket(previous, data);
    if (result.ok) setFormKey((k) => k + 1);
    return result;
  }, null);

  return (
    <form key={formKey} action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="ticketId" value={ticketId} />
      <FormError state={state} />
      <TextareaField label="Your reply" name="body" rows={5} required disabled={disabled} error={fieldError(state, "body")} />
      <FileDropzone
        name="attachments[]"
        label="Attachments (optional)"
        multiple
        maxFiles={3}
        hint="Up to 3 files — PNG, JPG, WebP or PDF, 5 MB each."
        error={fieldError(state, "attachments")?.[0]}
      />
      <Button type="submit" size="lg" loading={pending} disabled={disabled}>
        Send reply
      </Button>
    </form>
  );
}

export function TicketStatusButton({ ticketId, current }: { ticketId: string; current: "open" | "awaiting_customer" | "resolved" | "closed" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const resolving = current === "open" || current === "awaiting_customer";

  return (
    <div>
      <Button
        variant="secondary"
        loading={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await setTicketStatus({ ticketId, status: resolving ? "resolved" : "open" });
            if (result.ok) router.refresh();
            else setError(result.message);
          })
        }
      >
        {resolving ? "Mark as resolved" : "Reopen ticket"}
      </Button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
