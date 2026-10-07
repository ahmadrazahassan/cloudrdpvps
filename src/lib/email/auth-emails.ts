import { renderLayout, type EmailContext } from "./layout";

/**
 * The six emails Supabase Auth sends (confirm sign-up, reset password, change email, invite, magic link,
 * reauthentication), written in the same layout as the app's own emails so a customer sees one consistent brand.
 *
 * Supabase fills in the `{{ .Placeholders }}` when it sends. These pure functions produce the HTML files kept in
 * `supabase/templates/` — run `npm run emails:build` after changing anything here (a test fails if the files are
 * out of date). Paste each file into Supabase → Authentication → Email Templates.
 */

/** Placeholders Supabase understands; the layout leaves them untouched. */
const SITE = "{{ .SiteURL }}";
const ctx: EmailContext = { siteName: "Cloud RDP VPS", siteUrl: SITE, supportEmail: null };

const confirmLink = (type: string, next: string) => `${SITE}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}&next=${next}`;

export interface AuthEmail {
  file: string;
  /** The Supabase template it goes in. */
  where: string;
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  code?: string;
  note?: string;
  reason: string;
}

export const AUTH_EMAILS: AuthEmail[] = [
  {
    file: "confirm-signup.html",
    where: "Confirm sign up",
    subject: "Confirm your email address",
    preheader: "One click to finish creating your account.",
    heading: "Confirm your email address",
    paragraphs: ["Welcome. Confirm your email address to finish creating your account. You need a confirmed address before you can place an order."],
    action: { label: "Confirm my email", url: confirmLink("signup", "/dashboard") },
    note: "The link works once and expires after a while.",
    reason: "You're receiving this because someone used this address to create an account with Cloud RDP VPS. If that wasn't you, ignore this email: nothing happens until the link is used.",
  },
  {
    file: "reset-password.html",
    where: "Reset password",
    subject: "Reset your password",
    preheader: "Use this link to choose a new password.",
    heading: "Reset your password",
    paragraphs: ["We received a request to reset the password for your account. Use the button below to choose a new one."],
    action: { label: "Choose a new password", url: confirmLink("recovery", "/reset-password") },
    note: "The link works once and expires soon.",
    reason: "You're receiving this because a password reset was requested for your Cloud RDP VPS account. If it wasn't you, ignore this email: your password stays as it is.",
  },
  {
    file: "change-email.html",
    where: "Change email address",
    subject: "Confirm your new email address",
    preheader: "Confirm the change to your account's email address.",
    heading: "Confirm your new email address",
    paragraphs: ["You asked to change the email address on your account from {{ .Email }} to {{ .NewEmail }}. Confirm it with the button below."],
    action: { label: "Confirm the change", url: confirmLink("email_change", "/dashboard/settings") },
    reason: "You're receiving this because a change of email address was requested on your Cloud RDP VPS account. If it wasn't you, don't use the link and reset your password.",
  },
  {
    file: "invite.html",
    where: "Invite user",
    subject: "You've been invited",
    preheader: "Accept the invitation and choose a password.",
    heading: "You've been invited",
    paragraphs: ["You've been invited to join the Cloud RDP VPS team. Accept the invitation and choose a password to get started."],
    action: { label: "Accept the invitation", url: confirmLink("invite", "/reset-password") },
    reason: "You're receiving this because someone on the Cloud RDP VPS team invited this address. If you weren't expecting it, ignore this email.",
  },
  {
    file: "magic-link.html",
    where: "Magic link",
    subject: "Your sign-in link",
    preheader: "Use this link to sign in.",
    heading: "Sign in to your account",
    paragraphs: ["Use the button below to sign in. The link works once and expires soon."],
    action: { label: "Sign in", url: confirmLink("magiclink", "/dashboard") },
    reason: "You're receiving this because someone asked to sign in to your Cloud RDP VPS account with this address. If it wasn't you, ignore this email.",
  },
  {
    file: "reauthentication.html",
    where: "Reauthentication",
    subject: "Your confirmation code",
    preheader: "Enter this code to confirm it's you.",
    heading: "Your confirmation code",
    paragraphs: ["Enter this code to confirm it's you."],
    code: "{{ .Token }}",
    reason: "You're receiving this because a sensitive change was started on your Cloud RDP VPS account. If it wasn't you, reset your password.",
  },
];

/** The finished file: a short note for whoever pastes it into Supabase, then the email itself. */
export function renderAuthEmail(e: AuthEmail): string {
  const { html } = renderLayout({
    ctx,
    subject: e.subject,
    preheader: e.preheader,
    heading: e.heading,
    paragraphs: e.paragraphs,
    action: e.action,
    showLink: Boolean(e.action),
    code: e.code,
    note: e.note,
    reason: e.reason,
  });
  const header = `<!--
  Supabase Auth email: ${e.where}
  Subject line to use:  ${e.subject}
  Paste this file into Supabase -> Authentication -> Email Templates -> ${e.where}.
  Generated by "npm run emails:build" from src/lib/email/auth-emails.ts - edit that file, not this one.
  Words written in double curly braces are placeholders Supabase fills in when it sends.
-->
`;
  return header + html;
}
