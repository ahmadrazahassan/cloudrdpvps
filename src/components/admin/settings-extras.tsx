"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { sendTestEmail } from "@/lib/admin/actions/system";

/** "Send test email" — mails the signed-in admin to prove email sending works. */
export function TestEmail({ configured }: { configured: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="space-y-3">
      <p className="max-w-[60ch] text-[14px] text-ink-2">
        {configured ? "Email sending is configured. Send yourself a test to make sure it arrives." : "Email sending isn't configured yet. Add RESEND_API_KEY and EMAIL_FROM to the server's environment, then test it here. Until then, notification emails stay queued."}
      </p>
      <Button
        variant="secondary"
        size="sm"
        loading={pending}
        disabled={!configured}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await sendTestEmail({});
            setMsg(r.ok ? { ok: true, text: `Sent to ${r.data.to}.` } : { ok: false, text: r.message });
          })
        }
      >
        Send test email
      </Button>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className="form-note" data-tone={msg.ok ? "ok" : "error"}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
