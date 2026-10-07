"use client";

import { Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { CopyButton } from "@/components/portal/copy-button";
import { Button } from "@/components/ui/button";
import { revealCredentialsAdmin } from "@/lib/admin/actions/services";

/**
 * Admin-only reveal of a server's login. The stored login is not readable by the browser at all, so
 * both the username and the password stay masked until you ask. Every reveal is written to the audit log
 * by the database, the password is decrypted on the server for this one response, and it masks itself
 * again after 30 seconds.
 */
export function RevealCredentials({ serviceId }: { serviceId: string }) {
  const [secret, setSecret] = useState<{ username: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function reveal() {
    setError(null);
    start(async () => {
      const r = await revealCredentialsAdmin({ serviceId });
      if (!r.ok) return setError(r.message);
      setSecret({ username: r.data.username, password: r.data.password });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setSecret(null), 30_000);
    });
  }

  const mask = (
    <span className="text-[14px] tracking-[0.2em] text-muted" aria-label="Hidden">
      ••••••••••••
    </span>
  );

  return (
    <div>
      <dl className="divide-y divide-line rounded-card border border-line px-4">
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-[13px] text-muted">Username</dt>
          <dd className="flex min-w-0 items-center gap-1">
            {secret ? (
              <>
                <span className="data-id break-all text-[14px] font-medium text-ink">{secret.username}</span>
                <CopyButton value={secret.username} label="Copy username" />
              </>
            ) : (
              mask
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-[13px] text-muted">Password</dt>
          <dd className="flex min-w-0 items-center gap-1">
            {secret ? (
              <>
                <span className="data-id select-all break-all text-[14px] font-medium text-ink">{secret.password}</span>
                <CopyButton value={secret.password} label="Copy password" />
                <button
                  type="button"
                  onClick={() => setSecret(null)}
                  aria-label="Hide login"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-btn text-muted hover:bg-black/[0.05] hover:text-ink"
                >
                  <EyeOff size={16} strokeWidth={1.5} aria-hidden />
                </button>
              </>
            ) : (
              mask
            )}
          </dd>
        </div>
      </dl>
      {secret ? (
        <p className="mt-3 text-[12.5px] text-muted" role="status">
          Visible for 30 seconds, then it hides itself.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary" loading={pending} onClick={reveal}>
            <Eye size={16} strokeWidth={1.5} aria-hidden /> Reveal login
          </Button>
          <p className="text-[12.5px] text-muted">Recorded in the audit log. Hides after 30 seconds.</p>
        </div>
      )}
      {error && (
        <p role="alert" className="field-error mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
