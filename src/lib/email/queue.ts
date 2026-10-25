import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { drainEmailOutbox } from "./drain";
import { emailConfigured } from "./send";

/**
 * Putting emails on the queue (`email_outbox`) and getting them out quickly.
 *
 * Almost every email is queued by the database in the same transaction as the event that causes it (an order
 * placed, a payment approved, a server delivered…). Two kinds start in the app instead — the welcome email and
 * the "your password was changed" notice — and use `enqueueEmail` below. Either way `drainSoon` sends what is
 * waiting a moment after the response has gone out, so a customer gets the email within seconds; the scheduled
 * `/api/cron/maintenance` run is the safety net that retries anything that failed.
 *
 * Email must never get in the way of what the person was doing, so nothing here throws.
 */

/** Queue one email. Returns false (and logs) when it couldn't be queued; never throws. */
export async function enqueueEmail(mail: { userId: string; to: string; template: string; data?: Record<string, Json> }): Promise<boolean> {
  try {
    const { error } = await createAdminClient()
      .from("email_outbox")
      .insert({ user_id: mail.userId, to_email: mail.to, template: mail.template, data: mail.data ?? {} });
    if (error) throw new Error(error.message);
    return true;
  } catch (error) {
    console.error(`[email:enqueue:${mail.template}]`, error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * The welcome email, once per account: called when an address is confirmed (or straight after sign-up when the
 * project doesn't require confirmation). Safe to call twice — a second call finds the first and does nothing.
 */
export async function queueWelcomeEmail(user: { id: string; email: string; name?: string | null }): Promise<boolean> {
  try {
    const db = createAdminClient();
    const existing = await db.from("email_outbox").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("template", "welcome");
    if (existing.error) throw new Error(existing.error.message);
    if ((existing.count ?? 0) > 0) return false;
  } catch (error) {
    console.error("[email:welcome]", error instanceof Error ? error.message : error);
    return false;
  }
  return enqueueEmail({ userId: user.id, to: user.email, template: "welcome", data: { name: user.name?.trim() ?? "" } });
}

/**
 * "New order" alert to every active admin (same opt-out as the database's staff alerts:
 * profiles.notification_prefs.staff_alerts = false). The customer's own "we received your order" email is queued
 * by `create_order` itself; this one tells the team. Never throws.
 */
export async function queueStaffOrderAlert(order: {
  id: string;
  order_number: string;
  total_cents: number;
  type: string;
  plan_name: string;
  location_name: string;
  customerEmail?: string | null;
}): Promise<number> {
  try {
    const db = createAdminClient();
    const admins = await db.from("profiles").select("id, email, notification_prefs").eq("role", "admin").eq("status", "active");
    if (admins.error) throw new Error(admins.error.message);
    const rows = (admins.data ?? [])
      .filter((p) => p.email && (p.notification_prefs as Record<string, unknown> | null)?.staff_alerts !== false)
      .map((p) => ({
        user_id: p.id,
        to_email: p.email,
        template: "staff_order_placed",
        data: {
          order_id: order.id,
          order_number: order.order_number,
          total_cents: order.total_cents,
          type: order.type,
          plan: order.plan_name,
          location: order.location_name,
          customer: order.customerEmail ?? "",
        },
      }));
    if (!rows.length) return 0;
    const { error } = await db.from("email_outbox").insert(rows);
    if (error) throw new Error(error.message);
    return rows.length;
  } catch (error) {
    console.error("[email:staff_order_placed]", error instanceof Error ? error.message : error);
    return 0;
  }
}

/**
 * Send whatever is due, right after the current response is finished (Next's `after`), so the person isn't kept
 * waiting on the email provider. Does nothing until RESEND_API_KEY and EMAIL_FROM are set — rows simply stay queued.
 * Called outside a request (a script, a test) it quietly does nothing and the scheduled run picks the rows up.
 */
export function drainSoon(): void {
  if (!emailConfigured()) return;
  try {
    after(async () => {
      try {
        await drainEmailOutbox();
      } catch (error) {
        console.error("[email:drain]", error instanceof Error ? error.message : error);
      }
    });
  } catch {
    /* not in a request: the scheduled drain will send it */
  }
}
