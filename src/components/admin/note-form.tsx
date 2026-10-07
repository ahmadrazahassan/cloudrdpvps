"use client";

import { useState, useTransition } from "react";
import { addNote } from "@/lib/admin/actions/notes";
import { Button } from "@/components/ui/button";

/** Add an internal note to a customer, order or service. Staff only; customers never see notes. */
export function NoteForm({ entityType, entityId }: { entityType: "customer" | "order" | "service"; entityId: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await addNote({ entityType, entityId, body });
      if (result.ok) setBody("");
      else setError(result.fieldErrors?.body?.[0] ?? result.message);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <label htmlFor={`note-${entityId}`} className="sr-only">
        Internal note
      </label>
      <textarea
        id={`note-${entityId}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add an internal note — only staff can see it"
        className="field-textarea !min-h-[84px] !text-[14.5px]"
        maxLength={5000}
      />
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <Button type="submit" size="sm" variant="secondary" loading={pending} disabled={!body.trim()}>
        Add note
      </Button>
    </form>
  );
}
