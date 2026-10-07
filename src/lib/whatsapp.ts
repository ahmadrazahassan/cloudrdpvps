/**
 * WhatsApp "click to chat" links. The owner keeps one link in Admin → Settings → General; this module turns whatever they
 * typed (a number or a link) into that link, and turns the link back into a chat URL with the visitor's message filled in.
 * Pure — no React, no server-only — so the browser widget, the admin action and the tests all share it.
 */

/** Only WhatsApp's own hosts: the stored link is opened from our site, so it must never point anywhere else. */
const HOSTS = new Set(["wa.me", "api.whatsapp.com", "chat.whatsapp.com", "whatsapp.com", "www.whatsapp.com"]);

/** An international number without "+" or leading zeros (E.164): 8–15 digits, never starting with 0. */
const PHONE = /^[1-9]\d{7,14}$/;
const CODE = /^[A-Za-z0-9_-]+$/;

/** Longest message we put in a chat link (links have length limits and a chat opener should be short). */
export const MESSAGE_MAX = 600;

export interface WhatsAppTarget {
  /** Where the chat opens, with no message attached. */
  url: string;
  /** International digits (no "+") when the link is a number — the only kind a message can be filled into. */
  phone: string | null;
}

const withPhone = (phone: string): WhatsAppTarget => ({ url: `https://wa.me/${phone}`, phone });

/** Read a stored link. Returns null for anything that isn't a WhatsApp chat link we trust. */
export function parseWhatsAppTarget(href: string | null | undefined): WhatsAppTarget | null {
  if (!href) return null;
  let u: URL;
  try {
    u = new URL(href.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== "https:" || !HOSTS.has(host) || u.username || u.password || u.port) return null;
  const segments = u.pathname.split("/").filter(Boolean);

  if (host === "wa.me") {
    const first = segments[0]?.replace(/^\+/, "") ?? "";
    if (segments.length === 1 && PHONE.test(first)) return withPhone(first);
    // Business short links (wa.me/message/CODE) can't take a message.
    if (segments.length === 2 && segments[0] === "message" && CODE.test(segments[1]!)) {
      return { url: `https://wa.me/message/${segments[1]}`, phone: null };
    }
    return null;
  }
  if (host === "chat.whatsapp.com") {
    return segments.length === 1 && CODE.test(segments[0]!) ? { url: `https://chat.whatsapp.com/${segments[0]}`, phone: null } : null;
  }
  // api.whatsapp.com/send?phone=… (and the same path on whatsapp.com)
  if (segments[0] === "send") {
    const phone = (u.searchParams.get("phone") ?? "").replace(/\D/g, "");
    return PHONE.test(phone) ? withPhone(phone) : null;
  }
  return null;
}

/**
 * What the owner typed in the settings field: a number ("+92 300 1234567", "0092 300 1234567") or a WhatsApp link.
 * Always saved as the canonical link, so every place that shows it (footer, contact page, chat) behaves the same.
 */
export function normalizeWhatsAppInput(raw: string): { ok: true; value: string } | { ok: false } {
  const input = raw.trim();
  if (/^\+?[\d\s().-]+$/.test(input)) {
    const digits = input.replace(/\D/g, "").replace(/^00/, "");
    return PHONE.test(digits) ? { ok: true, value: withPhone(digits).url } : { ok: false };
  }
  const target = parseWhatsAppTarget(input);
  return target ? { ok: true, value: target.url } : { ok: false };
}

/** The opening message: what the visitor wrote (or a greeting), plus the page they're on so the team has context. */
export function whatsAppMessage({ siteName, text, pageUrl }: { siteName: string; text?: string; pageUrl?: string }): string {
  const body = (text ?? "").replace(/[ \t]+\n/g, "\n").trim().slice(0, MESSAGE_MAX).trim();
  const opening = body || `Hi ${siteName}! I have a question.`;
  return pageUrl ? `${opening}\n\nSent from ${pageUrl}` : opening;
}

/** The URL that opens WhatsApp with the message already typed (or just the chat, for links that can't carry one). */
export function whatsAppChatUrl(target: WhatsAppTarget, message: string): string {
  return target.phone ? `https://wa.me/${target.phone}?text=${encodeURIComponent(message)}` : target.url;
}
