import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { drainEmailOutbox } from "@/lib/email/drain";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Housekeeping: cancel unpaid orders past their deadline, expire services, queue expiry
 * reminders, flag overdue terminations. On Supabase these already run from pg_cron
 * (migration 0008); this endpoint is the fallback for hosts without it — point any
 * scheduler (Vercel Cron, GitHub Actions, cron-job.org) at it every hour:
 *
 *   curl -X POST https://your-site/api/cron/maintenance -H "Authorization: Bearer $CRON_SECRET"
 *
 * Every job is idempotent, so running it more often than needed is harmless.
 */
export const dynamic = "force-dynamic";

const JOBS = ["cancel_stale_orders", "expire_services", "enqueue_expiry_reminders", "flag_terminate_due"] as const;

function authorized(request: Request): boolean {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return false; // not configured -> endpoint is closed
  const header = request.headers.get("authorization") ?? "";
  const given = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const supabase = createAdminClient();
  const results: Record<string, number | string> = {};
  let failed = false;

  for (const job of JOBS) {
    const { data, error } = await supabase.rpc(job);
    if (error) {
      failed = true;
      results[job] = "failed";
      console.error(`[cron:${job}]`, error.message);
    } else {
      results[job] = data ?? 0;
    }
  }

  // Queued emails (order, payment, delivery, expiry, ticket notices). Doing it here means one scheduler call
  // runs everything; schedule this endpoint every 5–10 minutes so customers aren't kept waiting for a notice.
  try {
    const mail = await drainEmailOutbox();
    results.email = mail.configured ? `${mail.sent} sent, ${mail.retrying} retrying, ${mail.failed} failed` : "skipped (RESEND_API_KEY / EMAIL_FROM not set)";
  } catch (error) {
    failed = true;
    results.email = "failed";
    console.error("[cron:email]", error instanceof Error ? error.message : error);
  }

  return NextResponse.json({ ok: !failed, results }, { status: failed ? 500 : 200, headers: { "Cache-Control": "no-store" } });
}

export { run as GET, run as POST };
