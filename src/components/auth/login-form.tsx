"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/(auth)/actions";
import { FormError, fieldError } from "@/components/auth/form-message";
import { ResendForm } from "@/components/auth/resend-form";
import { Turnstile } from "@/components/auth/turnstile";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";

/** `inline`: the form sits inside another page (the order page) — don't grab focus on load, and resend the confirmation email in place. */
export function LoginForm({ next, inline = false }: { next?: string; inline?: boolean }) {
  const [state, formAction, pending] = useActionState(login, null);
  const unconfirmed = Boolean(state && !state.ok && state.code === "EMAIL_NOT_CONFIRMED");

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <FormError state={state} />

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        autoFocus={!inline}
        error={fieldError(state, "email")}
      />
      <div>
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          error={fieldError(state, "password")}
        />
        <p className="mt-2 text-right text-sm">
          <Link href="/forgot-password" className="text-link">
            Forgot your password?
          </Link>
        </p>
      </div>

      <Turnstile resetKey={state} />

      {unconfirmed && !inline ? (
        <p className="text-sm text-ink-2">
          <Link href="/verify-email" className="text-link">
            Send a new confirmation email
          </Link>
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Sign in
      </Button>

      {unconfirmed && inline ? (
        <div className="border-t border-line pt-5">
          <p className="mb-4 text-[14px] text-ink-2">Your email address isn&apos;t confirmed yet. We can send the link again.</p>
          <ResendForm knownAddress next={next} />
        </div>
      ) : null}
    </form>
  );
}
