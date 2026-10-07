"use client";

import Link from "next/link";
import { useActionState } from "react";
import { register } from "@/app/(auth)/actions";
import { FormError, FormSuccess, fieldError } from "@/components/auth/form-message";
import { ResendForm } from "@/components/auth/resend-form";
import { Turnstile } from "@/components/auth/turnstile";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";

/**
 * `inline`: the form sits inside another page (the order page). Nothing steals focus on load, and after sign-up the
 * "check your inbox" message appears right there — the emailed link brings them back to `next`.
 */
export function RegisterForm({ next, inline = false }: { next?: string; inline?: boolean }) {
  const [state, formAction, pending] = useActionState(register, null);
  const termsError = fieldError(state, "terms");

  if (state?.ok && state.data.confirmEmail) {
    return (
      <div className="space-y-6">
        <FormSuccess>
          We sent a confirmation link to <strong className="font-semibold">{state.data.email}</strong>. Open it and you&apos;ll come straight back here with your choice kept.
        </FormSuccess>
        <ResendForm knownAddress next={next} />
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {inline ? <input type="hidden" name="inline" value="1" /> : null}
      <FormError state={state} />

      <Field label="Full name" name="fullName" autoComplete="name" required autoFocus={!inline} error={fieldError(state, "fullName")} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        error={fieldError(state, "email")}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        required
        hint="At least 10 characters, with a letter and a number."
        error={fieldError(state, "password")}
      />

      <div>
        <label className="check">
          <input type="checkbox" name="terms" aria-invalid={termsError ? true : undefined} />
          <span>
            I agree to the{" "}
            <Link href="/legal/terms" className="text-link" target={inline ? "_blank" : undefined}>
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="text-link" target={inline ? "_blank" : undefined}>
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {termsError ? <p className="field-error">{termsError[0]}</p> : null}
      </div>

      <Turnstile resetKey={state} />

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Create account
      </Button>
    </form>
  );
}
