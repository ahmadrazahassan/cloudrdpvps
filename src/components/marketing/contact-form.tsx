"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitContactForm } from "@/app/(marketing)/contact/actions";
import { CONTACT_TOPICS } from "@/app/(marketing)/contact/topics";
import { FormError, fieldError } from "@/components/auth/form-message";
import { Turnstile } from "@/components/auth/turnstile";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, SelectField, TextareaField } from "@/components/ui/field";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContactForm, null);

  if (state?.ok) {
    return (
      <div role="status" className="border-t border-lav-600 pt-8">
        <h2 className="text-[26px] font-medium leading-tight tracking-[-0.02em] text-ink">Thanks, we&apos;ve got it.</h2>
        <p className="mt-3 max-w-[44ch] text-[16px] leading-[1.7] text-ink-2">
          Your message is with our team. We&apos;ll reply to the email address you gave us.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/" variant="secondary">
            Back to the homepage
          </ButtonLink>
          <ButtonLink href="/faq" variant="ghost">
            Read the FAQ
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormError state={state} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" name="name" autoComplete="name" required error={fieldError(state, "name")} />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          error={fieldError(state, "email")}
        />
      </div>

      <SelectField
        label="What is this about?"
        name="topic"
        required
        defaultValue=""
        placeholder="Choose a topic"
        options={CONTACT_TOPICS.map((t) => ({ value: t.value, label: t.label }))}
        error={fieldError(state, "topic")}
      />

      <TextareaField
        label="Message"
        name="message"
        rows={6}
        required
        hint="If it's about an order, include the order number."
        error={fieldError(state, "message")}
      />

      {/* Honeypot: hidden from people and assistive tech, tempting to bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Turnstile resetKey={state} />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button type="submit" size="lg" loading={pending}>
          Send message
        </Button>
        <p className="max-w-[40ch] text-[13px] leading-relaxed text-muted">
          By sending this you agree to our{" "}
          <Link href="/legal/privacy" className="text-link">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
