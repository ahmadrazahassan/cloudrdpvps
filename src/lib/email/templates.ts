/**
 * Transactional email content. Pure functions (no I/O) so every template is testable.
 *
 * Rules these templates follow:
 *   - They are rendered from the small `data` object the database queued with the event. That object never
 *     contains a password or any login detail, and these templates never ask for one — a "your server is ready"
 *     email only links to the dashboard, where the login is shown behind the owner's session.
 *   - Everything dynamic is HTML-escaped in the HTML part.
 */

export interface EmailContext {
  siteName: string;
  /** Origin without a trailing slash, e.g. https://cloudrdpvps.com */
  siteUrl: string;
  supportEmail: string | null;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : fallback);
const usd = (cents: unknown) => (typeof cents === "number" ? `$${(cents / 100).toFixed(2)}` : "");
const date = (iso: unknown) => {
  if (typeof iso !== "string") return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};

interface Draft {
  subject: string;
  /** Paragraphs of plain text. */
  lines: string[];
  action?: { label: string; path: string };
}

function draft(template: string, d: Record<string, unknown>, ctx: EmailContext): Draft | null {
  const order = str(d.order_number);
  const label = str(d.label, "your server");
  switch (template) {
    case "order_placed":
      return {
        subject: `We received your order ${order}`,
        lines: [`Thanks for your order ${order}${typeof d.total_cents === "number" ? ` (${usd(d.total_cents)})` : ""}.`, "To get your server started, send the payment using the details on the payment page, then upload your proof of payment. Unpaid orders are cancelled automatically after the time shown on the order."],
        action: { label: "Pay for this order", path: `/dashboard/orders/${str(d.order_id)}/pay` },
      };
    case "payment_under_review":
      return {
        subject: `We're checking your payment for ${order}`,
        lines: ["We have your proof of payment and our team is verifying it now. We'll email you as soon as it's confirmed."],
        action: { label: "View the order", path: `/dashboard/orders/${str(d.order_id)}` },
      };
    case "payment_approved":
      return {
        subject: `Payment verified for ${order}`,
        lines: ["Your payment is verified. Our team is now setting up your server, and we'll notify you the moment it's ready."],
        action: { label: "View the order", path: `/dashboard/orders/${str(d.order_id)}` },
      };
    case "payment_rejected":
      return {
        subject: `We couldn't verify your payment for ${order}`,
        lines: [`We couldn't verify the payment you submitted for ${order}.`, str(d.reason) ? `Reason: ${str(d.reason)}` : "", "You have extra time to fix it: open the order and submit new proof, or contact us if you need help."].filter(Boolean),
        action: { label: "Submit new proof", path: `/dashboard/orders/${str(d.order_id)}/pay` },
      };
    case "renewal_confirmed":
      return {
        subject: `Renewal confirmed for ${order}`,
        lines: [`Your renewal is confirmed${date(d.expires_at) ? ` and your server now runs until ${date(d.expires_at)}` : ""}. Thank you.`],
        action: { label: "Open your server", path: `/dashboard/services/${str(d.service_id)}` },
      };
    case "service_delivered":
      return {
        subject: `Your server is ready${d.order_number ? ` (${order})` : ""}`,
        lines: [`${label} has been set up. For your security the connection details are not sent by email — sign in to your dashboard to see them.`],
        action: { label: "See connection details", path: `/dashboard/services/${str(d.service_id)}` },
      };
    case "service_expired":
      return {
        subject: `${label} has expired`,
        lines: [`${label} has expired and access has been paused. Renew now to keep it — there is a short grace period before it is removed.`],
        action: { label: "Renew this server", path: `/dashboard/services/${str(d.service_id)}` },
      };
    case "expiring_soon": {
      const days = typeof d.days === "number" ? d.days : null;
      return {
        subject: `${label} expires${days !== null ? ` in ${days === 1 ? "1 day" : `${days} days`}` : " soon"}`,
        lines: [`${label} expires${date(d.expires_at) ? ` on ${date(d.expires_at)}` : " soon"}. Renewing adds another 30 days to the end of the current term. Nothing renews automatically.`],
        action: { label: "Renew this server", path: `/dashboard/services/${str(d.service_id)}` },
      };
    }
    case "account_suspended":
      return {
        subject: "Your account has been suspended",
        lines: ["Your account has been suspended, so new orders are paused. Your servers keep running and you can still open support tickets.", str(d.reason) ? `Reason: ${str(d.reason)}` : "", "If you think this is a mistake, reply to this email or open a ticket."].filter(Boolean),
        action: { label: "Contact support", path: "/dashboard/tickets/new" },
      };
    case "ticket_reply":
      return {
        subject: `New reply on ticket #${str(d.ticket_no)}: ${str(d.subject)}`,
        lines: [`Support replied to your ticket “${str(d.subject)}”.`],
        action: { label: "Read the reply", path: `/dashboard/tickets/${str(d.ticket_id)}` },
      };
    // ---- account ----
    case "welcome": {
      const name = str(d.name).trim().split(/\s+/)[0];
      return {
        subject: `Welcome to ${ctx.siteName}`,
        lines: [
          `${name ? `Hi ${name}, your` : "Your"} account is ready.`,
          "Here's how it works: choose a Windows RDP or VPS plan, send your payment, and upload the proof. Our team checks it by hand and delivers your server — you'll get an email the moment it's ready.",
          "Your server's login details are never sent by email. You'll find them in your dashboard once it's delivered.",
        ],
        action: { label: "Choose your plan", path: "/order/new" },
      };
    }
    case "password_changed":
      return {
        subject: "Your password was changed",
        lines: [
          "The password for your account was just changed, and every other device was signed out.",
          "If this was you, there's nothing more to do. If it wasn't, reset your password straight away and contact us.",
        ],
        action: { label: "Reset your password", path: "/forgot-password" },
      };
    // ---- staff alerts (sent to admins / support; never include a customer's message text) ----
    case "staff_payment_submitted":
      return {
        subject: `Payment to review: ${order}${typeof d.amount_cents === "number" ? ` (${usd(d.amount_cents)})` : ""}`,
        lines: [`A customer submitted proof of payment for ${order}${d.type === "renewal" ? " (a renewal)" : ""}${str(d.method) ? ` via ${str(d.method)}` : ""}.`, "Check it against your bank or wallet, then approve or reject it."],
        action: { label: "Review the payment", path: `/admin/payments?p=${str(d.payment_id)}` },
      };
    case "staff_ticket":
      return {
        subject: `${d.is_new === true ? "New ticket" : "New reply on ticket"} #${str(d.ticket_no)}: ${str(d.subject)}`,
        lines: [`${d.is_new === true ? "A customer opened a ticket" : "A customer replied to a ticket"}: “${str(d.subject)}”${str(d.priority) && d.priority !== "normal" ? ` (priority ${str(d.priority)})` : ""}.`],
        action: { label: "Open the ticket", path: `/admin/tickets/${str(d.ticket_id)}` },
      };
    case "staff_contact":
      return {
        subject: `New contact message${str(d.topic) ? ` — ${str(d.topic)}` : ""}`,
        lines: [`${str(d.name, "Someone")} sent a message through the contact form.`],
        action: { label: "Open the inbox", path: "/admin/inbox" },
      };
    case "test":
      return { subject: "Test email", lines: ["This is a test email from your admin settings. If you can read it, email sending works."] };
    default:
      return null;
  }
}

/** Returns null for a template name we don't know (the caller marks that row failed instead of sending nonsense). */
export function renderEmail(template: string, data: unknown, ctx: EmailContext): RenderedEmail | null {
  const d = draft(template, data && typeof data === "object" ? (data as Record<string, unknown>) : {}, ctx);
  if (!d) return null;

  const url = d.action ? `${ctx.siteUrl}${d.action.path}` : null;
  const footer = ctx.supportEmail ? `Questions? Reply to this email or write to ${ctx.supportEmail}.` : "Questions? Open a ticket from your dashboard.";

  const text = [...d.lines, url ? `${d.action!.label}: ${url}` : "", footer, ctx.siteName].filter(Boolean).join("\n\n");

  const para = (s: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46">${escapeHtml(s)}</p>`;
  const button = url
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#7c4fcf;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">${escapeHtml(d.action!.label)}</a></p>`
    : "";
  // Same look as the Supabase Auth emails in supabase/templates: logo on the grey page, the message on a white card.
  const html = `<!doctype html><html lang="en"><body style="margin:0;padding:24px;background:#f1f1f1;font-family:Inter,'Segoe UI',Arial,sans-serif;color:#121214"><div style="max-width:520px;margin:0 auto"><p style="margin:0 0 24px"><img src="${escapeHtml(ctx.siteUrl)}/brand/logo-black.png" width="220" height="40" alt="${escapeHtml(ctx.siteName)}" style="display:block;border:0;max-width:100%;height:auto"></p><div style="padding:28px;background:#ffffff;border-radius:16px">${d.lines.map(para).join("")}${button}</div><p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#666670">${escapeHtml(footer)}</p></div></body></html>`;

  return { subject: d.subject, text, html };
}
