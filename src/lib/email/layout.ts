/**
 * The one visual layout every email shares — the app's own (`templates.ts`) and the ones Supabase Auth sends
 * (`auth-emails.ts`, written to `supabase/templates/` by `npm run emails:build`). Pure functions, no I/O.
 *
 * It follows the website: the #F1F1F1 page, one white card with a 20px radius, Inter, ink text, a lavender button.
 * Email clients are far less forgiving than browsers, so the markup is deliberately plain:
 *   - tables for structure, inline styles for everything (many clients drop <style> blocks; one small
 *     media query is kept for phones and is optional),
 *   - a solid-colour fallback under the button's gradient (Outlook ignores gradients),
 *   - exactly one image, the logo, with a width, a height and alt text,
 *   - a plain-text twin of every message, because a text part is part of what spam filters expect,
 *   - few links (the button only: the support address and the site name are plain text), and no script, form,
 *     tracking pixel or hidden text other than the short inbox preview line.
 */

export interface EmailContext {
  siteName: string;
  /** Origin without a trailing slash, e.g. https://cloudrdpvps.com */
  siteUrl: string;
  supportEmail: string | null;
  /** The company's name / address / tax lines from Admin → Settings, printed small at the foot. */
  address?: string[];
}

export interface LayoutInput {
  ctx: EmailContext;
  /** The <title> and, in text form, the subject. */
  subject: string;
  /** The grey line many inboxes show after the subject. One honest sentence. */
  preheader: string;
  heading: string;
  paragraphs: string[];
  /** Label / value pairs shown in a quiet box (order number, total…). */
  facts?: { label: string; value: string }[];
  action?: { label: string; url: string };
  /** Print the full address under the button — for links that carry a one-time token. */
  showLink?: boolean;
  /** A short code shown large (reauthentication). */
  code?: string;
  /** Small muted text inside the card, under the button. */
  note?: string;
  /** Why this person got the email, printed in the footer. */
  reason: string;
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Lines for the footer from the `company_block` setting: a string (one item per line) or a list of strings. */
export function addressLines(value: unknown): string[] {
  const raw = typeof value === "string" ? value.split("\n") : Array.isArray(value) ? value : [];
  return raw
    .filter((l): l is string => typeof l === "string")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4);
}

const INK = "#121214";
const INK_2 = "#3f3f46";
const MUTED = "#666670";
const LINE = "#e6e6ea";
const FONT = "Inter,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const DISPLAY = "'Inter Tight',Inter,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

/** The logo, hosted on the site. A 2x PNG of the real lockup, made by `npm run emails:build`. */
export const LOGO_PATH = "/brand/email-logo.png";

export function renderLayout(i: LayoutInput): { html: string; text: string } {
  const { ctx } = i;
  const host = ctx.siteUrl.replace(/^https?:\/\//, "");
  const footerLines = [
    i.reason,
    ctx.supportEmail ? `Questions? Reply to this email or write to ${ctx.supportEmail}.` : "Questions? Open a ticket from your dashboard.",
    ...(ctx.address?.length ? [ctx.address.join(" · ")] : []),
  ];

  // ---- plain text -------------------------------------------------------------------------------------------
  const text = [
    i.heading,
    ...i.paragraphs,
    i.facts?.length ? i.facts.map((f) => `${f.label}: ${f.value}`).join("\n") : "",
    i.code ?? "",
    i.action ? `${i.action.label}: ${i.action.url}` : "",
    i.note ?? "",
    "—",
    ...footerLines,
    `${ctx.siteName} · ${host}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // ---- html -------------------------------------------------------------------------------------------------
  const p = (s: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${INK_2}">${escapeHtml(s)}</p>`;

  const facts = i.facts?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr><td bgcolor="#f7f7f8" style="background:#f7f7f8;border-radius:12px;padding:6px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${i.facts
        .map(
          (f, n) =>
            `<tr><td style="padding:11px 12px 11px 0;font-size:13px;line-height:1.4;color:${MUTED};${n ? `border-top:1px solid ${LINE};` : ""}" valign="top">${escapeHtml(f.label)}</td><td align="right" style="padding:11px 0;font-size:14px;line-height:1.4;font-weight:600;color:${INK};${n ? `border-top:1px solid ${LINE};` : ""}" valign="top">${escapeHtml(f.value)}</td></tr>`,
        )
        .join("")}</table></td></tr></table>`
    : "";

  const code = i.code
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr><td align="center" bgcolor="#f7f7f8" style="background:#f7f7f8;border-radius:12px;padding:18px;font-family:${DISPLAY};font-size:30px;line-height:1;font-weight:600;letter-spacing:6px;color:${INK}">${escapeHtml(i.code)}</td></tr></table>`
    : "";

  const button = i.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0"><tr><td bgcolor="#7c4fcf" style="background-color:#7c4fcf;background-image:linear-gradient(180deg,#8d63de,#6a3fbd);border:1px solid #5b30a8;border-radius:10px"><a href="${escapeHtml(i.action.url)}" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:14px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none">${escapeHtml(i.action.label)}</a></td></tr></table>`
    : "";

  const link =
    i.action && i.showLink
      ? `<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:${MUTED}">Or paste this address into your browser:<br><span style="word-break:break-all;color:${INK_2}">${escapeHtml(i.action.url)}</span></p>`
      : "";

  const note = i.note ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:${MUTED}">${escapeHtml(i.note)}</p>` : "";

  const footer = `${footerLines.map((l) => `<p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${MUTED}">${escapeHtml(l)}</p>`).join("")}<p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED}">${escapeHtml(ctx.siteName)} · ${escapeHtml(host)}</p>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(i.subject)}</title>
<style>:root{color-scheme:light only}@media (max-width:600px){.card{padding:28px 22px 26px!important}.wrap{padding:16px 12px!important}}</style>
</head>
<body style="margin:0;padding:0;background:#f1f1f1;font-family:${FONT};color:${INK}" bgcolor="#f1f1f1">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#f1f1f1;mso-hide:all">${escapeHtml(i.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f1f1" style="background:#f1f1f1"><tr><td align="center" class="wrap" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td class="card" bgcolor="#ffffff" style="background:#ffffff;border:1px solid #e9e9ec;border-radius:20px;padding:36px 36px 32px">
<img src="${escapeHtml(ctx.siteUrl)}${LOGO_PATH}" width="176" height="32" alt="${escapeHtml(ctx.siteName)}" style="display:block;border:0;outline:none;height:32px;width:176px;margin:0 0 28px">
<h1 style="margin:0 0 14px;font-family:${DISPLAY};font-size:24px;line-height:1.25;font-weight:600;letter-spacing:-0.02em;color:${INK}">${escapeHtml(i.heading)}</h1>
${i.paragraphs.map(p).join("")}${facts}${code}${button}${link}${note}
</td></tr>
<tr><td style="padding:22px 8px 0">${footer}</td></tr>
</table>
</td></tr></table>
</body>
</html>
`;

  return { html, text };
}
