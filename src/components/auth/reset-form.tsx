"use client";

import { useActionState } from "react";
import { resetPassword } from "@/app/(auth)/actions";
import { FormError, fieldError } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";

export function ResetForm() {
  const [state, formAction, pending] = useActionState(resetPassword, null);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormError state={state} />
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        required
        autoFocus
        hint="At least 10 characters, with a letter and a number."
        error={fieldError(state, "password")}
      />
      <PasswordField
        label="Confirm new password"
        name="confirm"
        autoComplete="new-password"
        required
        error={fieldError(state, "confirm")}
      />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Update password
      </Button>
    </form>
  );
}
