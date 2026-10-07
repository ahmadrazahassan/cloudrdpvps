import { escapeHtml, renderLayout, type EmailContext } from "./layout";

/**
 * Transactional email content. Pure functions (no I/O) so every template is testable.
 *
 * Rules these templates follow:
 *   - They are rendered from the small `data` object the database queued with the event. That object never
 *     contains a password or any login detail, and these templates never ask for one — a "your server is ready"
 *     email only links to the dashboard, where the login is shown behind the owner's session.
 *   - Everything dynamic is HTML-escaped in the HTML part (see layout.ts).
 *   - Plain, calm wording: no exclamation marks, no capital-letter shouting, no sales language — which is also what
 *     keeps them out of spam folders (src/lib/email/deliverability.test.ts checks it).
 */

export { escapeHtml, type EmailContext };

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : fallback);
const usd = (cents: unknown) => (typeof cents === "number" ? `$${(cents / 100).toFixed(2)}` : "");
const date = (iso: unknown) => {
  if (typeof iso !== "string") return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};
const dateTime = (iso: unknown) => {
  if (typeof iso !== "string") return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : `${d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
};
/** Keep only the facts that have a value, so a missing field leaves no empty row. */
const facts = (rows: [string, string][]) => rows.filter(([, v]) => v).map(([label, value]) => ({ label, value }));

interface Draft {
  subject: string;
  preheader: string;
  heading: string;
  /** Paragraphs of plain text. */
  lines: string[];
  facts?: { label: string; value: string }[];
  action?: { label: string; path: string };
  note?: string;
  /** Who this email is for; decides the footer's "why am I getting this". */
  audience?: "customer" | "staff" | "admin";
}

function draft(template: string, d: Record<string, unknown>, ctx: EmailContext): Draft | null {
  const order = str(d.order_number);
  const label = str(d.label, "your server");
  switch (template) {
    case "order_placed":
      return {
        subject: `We received your order ${order}`,
        preheader: "Send your payment to get your server started.",
        heading: "Thanks for your order",
        lines: ["To get your server started, send the payment using the details on the payment page, then upload your proof of payment.", "Unpaid orders are cancelled automatically after the time shown on the order."],
        facts: facts([["Order", order], ["Total", usd(d.total_cents)]]),
        action: { label: "Pay for this order", path: `/dashboard/orders/${str(d.order_id)}/pay` },
      };
    case "payment_under_review":
      return {
        subject: `We're checking your payment for ${order}`,
        preheader: "We have your proof of payment and are verifying it now.",
        heading: "We're checking your payment",
        lines: ["We have your proof of payment and our team is verifying it now. We'll email you as soon as it's confirmed."],
        facts: facts([["Order", order]]),
        action: { label: "View the order", path: `/dashboard/orders/${str(d.order_id)}` },
      };
    case "payment_approved":
      return {
        subject: `Payment verified for ${order}`,
        preheader: "We're setting up your server now.",
        heading: "Payment verified",
        lines: ["Your payment is verified. Our team is now setting up your server, and we'll notify you the moment it's ready."],
        facts: facts([["Order", order]]),
        action: { label: "View the order", path: `/dashboard/orders/${str(d.order_id)}` },
      };
    case "payment_rejected":
      return {
        subject: `We couldn't verify your payment for ${order}`,
        preheader: "You have extra time to submit new proof.",
        heading: "We couldn't verify your payment",
        lines: [`We couldn't verify the payment you submitted for ${order}.`, "You have extra time to fix it: open the order and submit new proof, or contact us if you need help."],
        facts: facts([["Order", order], ["Reason", str(d.reason)]]),
        action: { label: "Submit new proof", path: `/dashboard/orders/${str(d.order_id)}/pay` },
      };
    case "renewal_confirmed":
      return {
        subject: `Renewal confirmed for ${order}`,
        preheader: "Your server has another 30 days.",
        heading: "Renewal confirmed",
        lines: ["Your renewal is confirmed. Thank you."],
        facts: facts([["Order", order], ["Runs until", date(d.expires_at)]]),
        action: { label: "Open your server", path: `/dashboard/services/${str(d.service_id)}` },
      };
    case "service_delivered":
      return {
        subject: `Your server is ready${d.order_number ? ` (${order})` : ""}`,
        preheader: "Sign in to your dashboard to see the connection details.",
        heading: "Your server is ready",
        lines: [`${label} has been set up. For your security the connection details are not sent by email — sign in to your dashboard to see them.`],
        facts: facts([["Server", str(d.label)], ["Order", order]]),
        action: { label: "See connection details", path: `/dashboard/services/${str(d.service_id)}` },
      };
    case "service_expired":
      return {
        subject: `${label} has expired`,
        preheader: "Renew to keep it. There is a short grace period before it is removed.",
        heading: `${label} has expired`,
        lines: [`${label} has expired and access has been paused. Renew now to keep it — there is a short grace period before it is removed.`],
        action: { label: "Renew this server", path: `/dashboard/services/${str(d.service_id)}` },
      };
    case "expiring_soon": {
      const days = typeof d.days === "number" ? d.days : null;
      const when = days !== null ? ` in ${days === 1 ? "1 day" : `${days} days`}` : " soon";
      return {
        subject: `${label} expires${when}`,
        preheader: "Renewing adds another 30 days. Nothing renews automatically.",
        heading: `${label} expires${when}`,
        lines: ["Renewing adds another 30 days to the end of the current term. Nothing renews automatically."],
        facts: facts([["Server", str(d.label)], ["Expires", date(d.expires_at)]]),
        action: { label: "Renew this server", path: `/dashboard/services/${str(d.service_id)}` },
      };
    }
    case "account_suspended":
      return {
        subject: "Your account has been suspended",
        preheader: "New orders are paused. Your servers keep running.",
        heading: "Your account has been suspended",
        lines: ["New orders are paused. Your servers keep running and you can still open support tickets.", "If you think this is a mistake, reply to this email or open a ticket."],
        facts: facts([["Reason", str(d.reason)]]),
        action: { label: "Contact support", path: "/dashboard/tickets/new" },
      };
    case "ticket_reply":
      return {
        subject: `New reply on ticket #${str(d.ticket_no)}: ${str(d.subject)}`,
        preheader: "Our team replied to your support ticket.",
        heading: "Support replied to your ticket",
        lines: ["Our team has replied. Open the ticket to read the message and answer."],
        facts: facts([["Ticket", `#${str(d.ticket_no)}`], ["Subject", str(d.subject)]]),
        action: { label: "Read the reply", path: `/dashboard/tickets/${str(d.ticket_id)}` },
      };
    // ---- account ----
    case "welcome": {
      const name = str(d.name).trim().split(/\s+/)[0];
      return {
        subject: `Welcome to ${ctx.siteName}`,
        preheader: "Your account is ready. Here is how ordering works.",
        heading: name ? `Welcome, ${name}` : `Welcome to ${ctx.siteName}`,
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
        preheader: "If this wasn't you, reset your password straight away.",
        heading: "Your password was changed",
        lines: ["The password for your account was just changed, and every other device was signed out.", "If this was you, there's nothing more to do. If it wasn't, reset your password straight away and contact us."],
        facts: facts([["When", dateTime(d.at)]]),
        action: { label: "Reset your password", path: "/forgot-password" },
      };
    // ---- staff alerts (sent to admins / support; never include a customer's message text) ----
    case "staff_payment_submitted":
      return {
        subject: `Payment to review: ${order}${typeof d.amount_cents === "number" ? ` (${usd(d.amount_cents)})` : ""}`,
        preheader: "A customer submitted proof of payment.",
        heading: "Payment to review",
        lines: [`A customer submitted proof of payment${d.type === "renewal" ? " for a renewal" : ""}. Check it against your bank or wallet, then approve or reject it.`],
        facts: facts([["Order", order], ["Amount", usd(d.amount_cents)], ["Method", str(d.method)], ["Type", d.type === "renewal" ? "Renewal" : "New server"]]),
        action: { label: "Review the payment", path: `/admin/payments?p=${str(d.payment_id)}` },
        audience: "admin",
      };
    case "staff_ticket":
      return {
        subject: `${d.is_new === true ? "New ticket" : "New reply on ticket"} #${str(d.ticket_no)}: ${str(d.subject)}`,
        preheader: d.is_new === true ? "A customer opened a ticket." : "A customer replied to a ticket.",
        heading: d.is_new === true ? "New support ticket" : "New reply on a ticket",
        lines: [d.is_new === true ? "A customer opened a ticket." : "A customer replied to a ticket."],
        facts: facts([["Ticket", `#${str(d.ticket_no)}`], ["Subject", str(d.subject)], ["Priority", str(d.priority) && d.priority !== "normal" ? str(d.priority) : ""]]),
        action: { label: "Open the ticket", path: `/admin/tickets/${str(d.ticket_id)}` },
        audience: "staff",
      };
    case "staff_contact":
      return {
        subject: `New contact message${str(d.topic) ? ` — ${str(d.topic)}` : ""}`,
        preheader: "Someone wrote to you through the contact form.",
        heading: "New contact message",
        lines: ["Someone sent a message through the contact form."],
        facts: facts([["From", str(d.name, "Someone")], ["Topic", str(d.topic)]]),
        action: { label: "Open the inbox", path: "/admin/inbox" },
        audience: "staff",
      };
    case "test":
      return {
        subject: "Test email",
        preheader: "If you can read this, email sending works.",
        heading: "Email is working",
        lines: ["This is a test email from your admin settings. If you can read it, email sending works."],
        audience: "admin",
      };
    default:
      return null;
  }
}

/** Why this person is getting the email — printed in the footer. */
function reasonFor(audience: Draft["audience"], ctx: EmailContext) {
  if (audience === "staff" || audience === "admin") return `You're receiving this because you're part of the ${ctx.siteName} team.`;
  return `You're receiving this email because you have an account with ${ctx.siteName}.`;
}

/** Returns null for a template name we don't know (the caller marks that row failed instead of sending nonsense). */
export function renderEmail(template: string, data: unknown, ctx: EmailContext): RenderedEmail | null {
  const d = draft(template, data && typeof data === "object" ? (data as Record<string, unknown>) : {}, ctx);
  if (!d) return null;

  const { html, text } = renderLayout({
    ctx,
    subject: d.subject,
    preheader: d.preheader,
    heading: d.heading,
    paragraphs: d.lines,
    facts: d.facts,
    action: d.action ? { label: d.action.label, url: `${ctx.siteUrl}${d.action.path}` } : undefined,
    note: d.note,
    reason: reasonFor(d.audience, ctx),
  });
  return { subject: d.subject, text, html };
}
