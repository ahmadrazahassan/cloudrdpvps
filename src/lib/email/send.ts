import "server-only";
import { serverEnv } from "@/lib/env.server";

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string | null;
}

export type SendResult = { ok: true } | { ok: false; error: string; /** true when retrying can't help (bad address, rejected content) */ permanent: boolean };

export const emailConfigured = () => {
  const env = serverEnv();
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
};

/**
 * Send one email through Resend's HTTP API (no SDK needed). Never throws: a failure comes back as a result so
 * the queue can retry or give up. The API key never leaves the server.
 */
export async function sendEmail(mail: OutgoingEmail): Promise<SendResult> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return { ok: false, error: "Email isn't configured (RESEND_API_KEY / EMAIL_FROM).", permanent: false };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html, ...(mail.replyTo ? { reply_to: mail.replyTo } : {}) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    // 4xx (except 429) means the request itself is wrong; retrying the same request won't change that.
    return { ok: false, error: `Resend ${res.status}: ${body?.message ?? res.statusText}`.slice(0, 300), permanent: res.status >= 400 && res.status < 500 && res.status !== 429 };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 300) : "network error", permanent: false };
  }
}
