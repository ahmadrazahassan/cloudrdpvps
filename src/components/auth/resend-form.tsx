"use client";

import { useActionState } from "react";
import { resendConfirmation } from "@/app/(auth)/actions";
import { FormError, FormSuccess, fieldError } from "@/components/auth/form-message";
import { Turnstile } from "@/components/auth/turnstile";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

/**
 * `knownAddress`: when the server already holds the address (cookie), no input is needed.
 * `next`: where the emailed link should bring them back to (the order page, say); defaults to the dashboard.
 */
export function ResendForm({ knownAddress, next, email }: { knownAddress: boolean; next?: string; email?: string }) {
  const [state, formAction, pending] = useActionState(resendConfirmation, null);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {email ? <input type="hidden" name="email" value={email} /> : null}
      {state?.ok ? (
        <FormSuccess>Sent. It can take a minute to arrive — check your spam folder too.</FormSuccess>
      ) : (
        <FormError state={state} />
      )}
      {knownAddress ? null : (
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          error={fieldError(state, "email")}
        />
      )}
      <Turnstile resetKey={state} />
      <Button type="submit" variant="secondary" size="lg" className="w-full" loading={pending}>
        Send a new confirmation email
      </Button>
    </form>
  );
}
