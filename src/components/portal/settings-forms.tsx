"use client";

import { useActionState } from "react";
import {
  changeEmail,
  changePassword,
  requestAccountDeletion,
  signOutEverywhere,
  updatePreferences,
  updateProfile,
} from "@/app/(portal)/dashboard/settings/actions";
import { FormError, FormSuccess, fieldError } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { ConfirmDialog } from "./confirm-dialog";

export interface ProfileValues {
  fullName: string;
  phone: string;
  billingCountry: string;
  company: string;
  telegram: string;
  whatsapp: string;
}

export function ProfileForm({ values, countries }: { values: ProfileValues; countries: { value: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState(updateProfile, null);
  return (
    <form action={formAction} className="max-w-[560px] space-y-5" noValidate>
      <FormError state={state} />
      {state?.ok && <FormSuccess>Your details are saved.</FormSuccess>}
      <Field label="Full name" name="fullName" defaultValue={values.fullName} autoComplete="name" required error={fieldError(state, "fullName")} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Phone" name="phone" type="tel" defaultValue={values.phone} autoComplete="tel" hint="Include the country code." error={fieldError(state, "phone")} />
        <SelectField
          label="Billing country"
          name="billingCountry"
          defaultValue={values.billingCountry}
          placeholder="Choose a country"
          options={countries}
          hint="Used to show the payment methods for where you pay from."
          error={fieldError(state, "billingCountry")}
        />
      </div>
      <Field label="Company (optional)" name="company" defaultValue={values.company} autoComplete="organization" error={fieldError(state, "company")} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Telegram (optional)" name="telegram" defaultValue={values.telegram} error={fieldError(state, "telegram")} />
        <Field label="WhatsApp (optional)" name="whatsapp" defaultValue={values.whatsapp} error={fieldError(state, "whatsapp")} />
      </div>
      <Button type="submit" loading={pending}>
        Save changes
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, null);
  return (
    <form key={state?.ok ? "done" : "form"} action={formAction} className="max-w-[420px] space-y-5" noValidate>
      <FormError state={state} />
      {state?.ok && <FormSuccess>Password changed. Other devices have been signed out.</FormSuccess>}
      <PasswordField label="Current password" name="current" autoComplete="current-password" required error={fieldError(state, "current")} />
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        required
        hint="At least 10 characters, with a letter and a number."
        error={fieldError(state, "password")}
      />
      <PasswordField label="Confirm new password" name="confirm" autoComplete="new-password" required error={fieldError(state, "confirm")} />
      <Button type="submit" loading={pending}>
        Change password
      </Button>
    </form>
  );
}

export function EmailForm({ current }: { current: string }) {
  const [state, formAction, pending] = useActionState(changeEmail, null);
  return (
    <form action={formAction} className="max-w-[420px] space-y-5" noValidate>
      <p className="text-[14px] text-muted">
        Signed in as <span className="font-semibold text-ink">{current}</span>
      </p>
      <FormError state={state} />
      {state?.ok && <FormSuccess>Check your inbox — we sent a confirmation link. Your address changes once you confirm it.</FormSuccess>}
      <Field label="New email address" name="newEmail" type="email" autoComplete="email" required error={fieldError(state, "newEmail")} />
      <Button type="submit" variant="secondary" loading={pending}>
        Send confirmation link
      </Button>
    </form>
  );
}

export function SignOutEverywhere() {
  return (
    <ConfirmDialog
      trigger={<Button variant="secondary">Sign out of all devices</Button>}
      title="Sign out everywhere?"
      description="Every device signed in to your account, including this one, will be signed out. You'll need to sign in again."
      confirmLabel="Sign out everywhere"
      cancelLabel="Stay signed in"
      onConfirm={() => signOutEverywhere({})}
    />
  );
}

export function PreferencesForm({ ticketReplies, marketing }: { ticketReplies: boolean; marketing: boolean }) {
  const [state, formAction, pending] = useActionState(updatePreferences, null);
  return (
    <form action={formAction} className="max-w-[560px]" noValidate>
      <FormError state={state} />
      {state?.ok && <FormSuccess>Preferences saved.</FormSuccess>}
      <p className="mb-3 text-[14px] font-medium text-ink-2">Email notifications</p>
      <ul className="divide-y divide-line rounded-card border border-line px-4">
        <li className="flex items-start justify-between gap-6 py-4">
          <div>
            <p className="text-[15px] font-semibold text-ink">Order, payment, delivery and expiry emails</p>
            <p className="mt-0.5 text-[13px] text-muted">These keep your servers running, so they can&apos;t be turned off.</p>
          </div>
          <span className="label-caps mt-1 shrink-0">Always on</span>
        </li>
        <li className="py-4">
          <label className="flex cursor-pointer items-start justify-between gap-6">
            <span>
              <span className="block text-[15px] font-semibold text-ink">Ticket replies</span>
              <span className="mt-0.5 block text-[13px] text-muted">Email me when support replies to a ticket.</span>
            </span>
            <input type="checkbox" name="ticket_replies" defaultChecked={ticketReplies} className="mt-1 h-[18px] w-[18px] shrink-0 accent-lav-600" />
          </label>
        </li>
        <li className="py-4">
          <label className="flex cursor-pointer items-start justify-between gap-6">
            <span>
              <span className="block text-[15px] font-semibold text-ink">News and offers</span>
              <span className="mt-0.5 block text-[13px] text-muted">Occasional product news. Off unless you turn it on.</span>
            </span>
            <input type="checkbox" name="marketing" defaultChecked={marketing} className="mt-1 h-[18px] w-[18px] shrink-0 accent-lav-600" />
          </label>
        </li>
      </ul>
      <div className="mt-6">
        <Button type="submit" loading={pending}>
          Save preferences
        </Button>
      </div>
    </form>
  );
}

export function DeletionForm({ blocked }: { blocked: boolean }) {
  const [state, formAction, pending] = useActionState(requestAccountDeletion, null);
  return (
    <form action={formAction} className="max-w-[560px] space-y-5" noValidate>
      <FormError state={state} />
      {blocked && (
        <p className="form-note" data-tone="error">
          You still have active servers. Let them expire, or ask us to terminate them, before requesting deletion.
        </p>
      )}
      <TextareaField label="Anything you'd like us to know? (optional)" name="reason" rows={3} disabled={blocked} error={fieldError(state, "reason")} />
      <div>
        <label className="check">
          <input type="checkbox" name="confirm" disabled={blocked} aria-invalid={fieldError(state, "confirm") ? true : undefined} />
          <span>I understand this opens a ticket and our team will delete my account and data once nothing is owed.</span>
        </label>
        {fieldError(state, "confirm") && <p className="field-error">{fieldError(state, "confirm")![0]}</p>}
      </div>
      <Button type="submit" variant="danger" loading={pending} disabled={blocked}>
        Request account deletion
      </Button>
    </form>
  );
}
