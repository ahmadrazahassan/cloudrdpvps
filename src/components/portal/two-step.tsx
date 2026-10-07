"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MfaPanel } from "@/components/auth/mfa-panel";
import { Button } from "@/components/ui/button";
import { getBrowserClient } from "@/lib/supabase/browser";

/**
 * Two-step verification (an authenticator app) for a customer account. Turning it on shows the same QR-code flow
 * staff use; once on, signing in asks for a 6-digit code after the password. Turning it off needs a current code,
 * so someone using a borrowed, signed-in browser can't quietly remove it.
 */
export function TwoStep({ enabled, canDisable = true }: { enabled: boolean; canDisable?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = getBrowserClient();
    const factor = (await supabase.auth.mfa.listFactors()).data?.totp[0];
    if (!factor) {
      setBusy(false);
      return router.refresh();
    }
    const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
    const verified = challenge.error ? challenge : await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.data.id, code: code.trim() });
    if (verified.error) {
      setBusy(false);
      setCode("");
      return setError("That code didn't work. Check the 6 digits and try again.");
    }
    const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    if (removed.error) return setError("We couldn't turn it off. Please try again.");
    setOpen(false);
    setCode("");
    router.refresh();
  }

  if (!enabled) {
    return open ? (
      <div className="max-w-[460px]">
        <MfaPanel enrolled={false} next={null} />
        <button type="button" onClick={() => setOpen(false)} className="text-link mt-5 text-[14px]">
          Cancel
        </button>
      </div>
    ) : (
      <div className="max-w-[560px] space-y-4">
        <p className="text-[15px] leading-relaxed text-ink-2">Add a second step to signing in: a 6-digit code from an authenticator app such as Google Authenticator or 1Password. A stolen password alone then can&apos;t open your account.</p>
        <Button onClick={() => setOpen(true)}>Set up two-step verification</Button>
      </div>
    );
  }

  return (
    <div className="max-w-[460px] space-y-4">
      <p className="flex items-center gap-2 text-[15px] font-semibold text-ok">
        <ShieldCheck size={18} strokeWidth={1.75} aria-hidden /> Two-step verification is on
      </p>
      {canDisable ? (
        open ? (
          <form onSubmit={disable} className="space-y-4" noValidate>
            <div className="field">
              <label htmlFor="disable-code" className="field-label">
                Enter a current 6-digit code to turn it off
              </label>
              <input
                id="disable-code"
                className="field-input num-tabular tracking-[0.3em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "disable-error" : undefined}
              />
              {error && (
                <p id="disable-error" role="alert" className="field-error">
                  {error}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button type="submit" variant="danger" loading={busy} disabled={code.length !== 6}>
                Turn off
              </Button>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Keep it on
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Turn off…
          </Button>
        )
      ) : (
        <p className="text-[14px] text-muted">Staff accounts must keep two-step verification on.</p>
      )}
    </div>
  );
}
