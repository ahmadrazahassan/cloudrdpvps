import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadEmailContext } from "./context";
import { emailConfigured, sendEmail } from "./send";
import { renderEmail } from "./templates";

const MAX_ATTEMPTS = 5;

export interface DrainResult {
  configured: boolean;
  sent: number;
  failed: number;
  retrying: number;
}

/**
 * Send the emails the database queued (`email_outbox`). Each event writes its email row in the same transaction
 * as the event itself, so a crash can never lose one; this drains them. Safe to run often and from more than one
 * place: a row is claimed by bumping its attempt counter only if nobody else has, so it is never sent twice.
 * Does nothing (rows stay queued) until RESEND_API_KEY and EMAIL_FROM are set.
 */
export async function drainEmailOutbox(limit = 25): Promise<DrainResult> {
  const result: DrainResult = { configured: emailConfigured(), sent: 0, failed: 0, retrying: 0 };
  if (!result.configured) return result;

  const db = createAdminClient();
  const ctx = await loadEmailContext(db);

  const due = await db
    .from("email_outbox")
    .select("id, to_email, template, data, attempts")
    .eq("status", "pending")
    .lte("send_after", new Date().toISOString())
    .order("send_after", { ascending: true })
    .limit(limit);
  if (due.error) throw new Error(`email_outbox query failed: ${due.error.message}`);

  for (const row of due.data ?? []) {
    // claim: only one worker can move attempts from N to N+1
    const claim = await db.from("email_outbox").update({ attempts: row.attempts + 1 }).eq("id", row.id).eq("status", "pending").eq("attempts", row.attempts).select("id");
    if (claim.error || !claim.data?.length) continue;

    const mail = renderEmail(row.template, row.data, ctx);
    if (!mail) {
      await db.from("email_outbox").update({ status: "failed", last_error: `Unknown template “${row.template}”` }).eq("id", row.id);
      result.failed += 1;
      continue;
    }

    const sent = await sendEmail({ to: row.to_email, ...mail, replyTo: ctx.supportEmail, headers: { "X-Entity-Ref-ID": row.id } });
    if (sent.ok) {
      await db.from("email_outbox").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", row.id);
      result.sent += 1;
    } else if (sent.permanent || row.attempts + 1 >= MAX_ATTEMPTS) {
      await db.from("email_outbox").update({ status: "failed", last_error: sent.error }).eq("id", row.id);
      result.failed += 1;
    } else {
      // back off: 15 min, 30 min, 45 min, …
      const retryAt = new Date(Date.now() + (row.attempts + 1) * 15 * 60_000).toISOString();
      await db.from("email_outbox").update({ send_after: retryAt, last_error: sent.error }).eq("id", row.id);
      result.retrying += 1;
    }
  }
  return result;
}
