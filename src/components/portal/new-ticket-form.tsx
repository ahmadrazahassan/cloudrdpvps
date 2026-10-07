"use client";

import { useActionState } from "react";
import { createTicket } from "@/app/(portal)/dashboard/tickets/actions";
import { TICKET_CATEGORIES } from "@/app/(portal)/dashboard/tickets/categories";
import { FormError, fieldError } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Field, SelectField, TextareaField } from "@/components/ui/field";

export function NewTicketForm({
  services,
  defaultServiceId,
  defaultCategory,
}: {
  services: { id: string; label: string; ip: string }[];
  defaultServiceId?: string;
  defaultCategory?: string;
}) {
  const [state, formAction, pending] = useActionState(createTicket, null);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormError state={state} />
      <Field label="Subject" name="subject" required maxLength={200} autoFocus error={fieldError(state, "subject")} />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Category"
          name="category"
          required
          defaultValue={TICKET_CATEGORIES.some((c) => c.value === defaultCategory) ? defaultCategory : ""}
          placeholder="Choose a category"
          options={TICKET_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          error={fieldError(state, "category")}
        />
        <SelectField
          label="Related server (optional)"
          name="serviceId"
          defaultValue={defaultServiceId ?? ""}
          placeholder="None"
          options={services.map((s) => ({ value: s.id, label: `${s.label} (${s.ip})` }))}
          error={fieldError(state, "serviceId")}
        />
      </div>
      <TextareaField
        label="What's happening?"
        name="message"
        rows={7}
        required
        hint="Include anything that helps us: error messages, what you tried, and when it started."
        error={fieldError(state, "message")}
      />
      <Button type="submit" size="lg" loading={pending}>
        Open ticket
      </Button>
    </form>
  );
}
