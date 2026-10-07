"use client";

import { useActionState } from "react";
import { forgotPassword } from "@/app/(auth)/actions";
import { FormError, FormSuccess, fieldError } from "@/components/auth/form-message";
import { Turnstile } from "@/components/auth/turnstile";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function ForgotForm() {
  const [state, formAction, pending] = useActionState(forgotPassword, null);

  if (state?.ok) {
    return (
      <FormSuccess>
        If that address has an account, a reset link is on its way. It expires after a short while — check your spam folder if you
        don&apos;t see it.
      </FormSuccess>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormError state={state} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        autoFocus
        error={fieldError(state, "email")}
      />
      <Turnstile resetKey={state} />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Send reset link
      </Button>
    </form>
  );
}
