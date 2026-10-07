"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { submitContactForm } from "@/app/(marketing)/contact/actions";
import { Turnstile } from "@/components/auth/turnstile";
import type { ActionResult } from "@/lib/action";

const input =
  "block w-full rounded-[10px] border border-white/25 bg-transparent px-4 py-3 text-[15px] text-white placeholder:text-white/55 transition-colors hover:border-white/40 focus:border-lav-300 focus:outline-none";

const fieldErrors = (state: ActionResult<unknown> | null, name: string) =>
  state && !state.ok ? state.fieldErrors?.[name] : undefined;

/**
 * "Questions before you order?" — the footer's form. It posts to the same action as the contact page
 * (topic "A question before I order"), so the message lands in the admin Inbox and staff are alerted.
 * The bot check only loads once someone clicks into the form, so it costs nothing on every other visit.
 */
export function FooterQuestionForm() {
  const [state, formAction, pending] = useActionState(submitContactForm, null);
  const [engaged, setEngaged] = useState(false);

  if (state?.ok) {
    return (
      <div role="status" className="mt-6 border-t border-lav-300 pt-5">
        <p className="font-display text-[22px] leading-tight tracking-[-0.02em] text-white">Thanks, we&apos;ve got it.</p>
        <p className="mt-2 max-w-[38ch] text-[15px] leading-relaxed text-white/70">
          Our team will reply to the email address you gave us.
        </p>
      </div>
    );
  }

  const nameErr = fieldErrors(state, "name");
  const emailErr = fieldErrors(state, "email");
  const messageErr = fieldErrors(state, "message");
  const formLevel = state && !state.ok && !(state.code === "VALIDATION" && state.fieldErrors && Object.keys(state.fieldErrors).length > 0);

  return (
    <form aria-labelledby="footer-ask" action={formAction} onFocus={() => setEngaged(true)} className="mt-6 space-y-3" noValidate>
      {formLevel && state && !state.ok && (
        <p role="alert" className="border-l-2 border-bad-soft pl-3 text-[14px] leading-snug text-bad-soft">
          {state.message}
        </p>
      )}

      <input type="hidden" name="topic" value="sales" />
      {/* Honeypot: hidden from people and assistive tech, tempting to bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <label htmlFor="footer-name" className="sr-only">
          Name
        </label>
        <input id="footer-name" name="name" autoComplete="name" placeholder="Name" aria-invalid={nameErr ? true : undefined} aria-describedby={nameErr ? "footer-name-err" : undefined} className={input} />
        {nameErr && (
          <p id="footer-name-err" className="mt-1.5 text-[13px] text-bad-soft">
            {nameErr[0]}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="footer-email" className="sr-only">
          E-mail address
        </label>
        <input id="footer-email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="E-mail" aria-invalid={emailErr ? true : undefined} aria-describedby={emailErr ? "footer-email-err" : undefined} className={input} />
        {emailErr && (
          <p id="footer-email-err" className="mt-1.5 text-[13px] text-bad-soft">
            {emailErr[0]}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="footer-message" className="sr-only">
          Your question
        </label>
        <textarea id="footer-message" name="message" rows={3} placeholder="Your question" aria-invalid={messageErr ? true : undefined} aria-describedby={messageErr ? "footer-message-err" : undefined} className={`${input} resize-none`} />
        {messageErr && (
          <p id="footer-message-err" className="mt-1.5 text-[13px] text-bad-soft">
            {messageErr[0]}
          </p>
        )}
      </div>

      <label className="flex items-start gap-2.5 pt-1 text-[13px] text-white/70">
        <input type="checkbox" required className="mt-[3px] h-[15px] w-[15px] shrink-0 accent-lav-300" />
        <span>
          I agree with the{" "}
          <Link href="/legal/privacy" className="text-lav-300 underline decoration-lav-300/40 underline-offset-4 hover:decoration-lav-300">
            privacy statement
          </Link>
        </span>
      </label>

      {engaged && <Turnstile resetKey={state} theme="dark" className="min-h-0" />}

      {/* A lavender icon square joined to a lavender label, 2px apart */}
      <button type="submit" disabled={pending} className="group mt-3 inline-flex gap-[2px] disabled:opacity-60">
        <span className="grid h-[46px] w-[46px] place-items-center rounded-[10px] bg-lav-300 text-ink transition-colors group-hover:bg-lav-200">
          <ArrowRight size={18} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="inline-flex h-[46px] items-center rounded-[10px] bg-lav-300 px-5 text-[15px] font-medium text-ink transition-colors group-hover:bg-lav-200">
          {pending ? "Sending…" : "Send your question"}
        </span>
      </button>
    </form>
  );
}
