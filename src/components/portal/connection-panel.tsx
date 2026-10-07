"use client";

import { Download, Eye, EyeOff, KeyRound } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { revealCredentials } from "@/app/(portal)/dashboard/services/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { CopyButton } from "./copy-button";

interface Revealed {
  username: string;
  password: string;
  expiresAt: number;
}

const MASK = "••••••••••";

/**
 * Login details for one server. Host and port are shown straight away; the username and password
 * come from the server only when asked for (each ask is audit-logged), stay in memory for 30 seconds,
 * then mask themselves again. Nothing is ever placed in the page markup while masked.
 */
export function ConnectionPanel({
  serviceId,
  host,
  port,
  label,
}: {
  serviceId: string;
  host: string;
  port: number;
  label: string;
}) {
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<number | undefined>(undefined);

  // Count down and auto-hide.
  useEffect(() => {
    if (!revealed) return;
    const tick = () => {
      const remaining = Math.ceil((revealed.expiresAt - Date.now()) / 1000);
      if (remaining <= 0) {
        setRevealed(null);
        setLeft(0);
      } else {
        setLeft(remaining);
      }
    };
    tick();
    timer.current = window.setInterval(tick, 500);
    return () => window.clearInterval(timer.current);
  }, [revealed]);

  function reveal() {
    setError(null);
    start(async () => {
      const result = await revealCredentials({ serviceId });
      if (result.ok) setRevealed(result.data);
      else setError(result.message);
    });
  }

  const row = "grid gap-1 border-b border-line py-4 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-6";

  return (
    <div>
      <dl className="border-t border-line">
        <div className={row}>
          <dt className="label-caps">Host</dt>
          <dd className="data-id flex items-center gap-1 text-[16px] font-medium text-ink">
            {host}
            <CopyButton value={host} label="Copy host" />
          </dd>
        </div>
        <div className={row}>
          <dt className="label-caps">Port</dt>
          <dd className="data-id flex items-center gap-1 text-[16px] font-medium text-ink">
            {port}
            <CopyButton value={String(port)} label="Copy port" />
          </dd>
        </div>
        <div className={row}>
          <dt className="label-caps">Username</dt>
          <dd className="data-id flex items-center gap-1 text-[16px] font-medium text-ink">
            {revealed ? (
              <>
                {revealed.username}
                <CopyButton value={revealed.username} label="Copy username" />
              </>
            ) : (
              <span aria-label="Hidden" className="text-muted">
                {MASK}
              </span>
            )}
          </dd>
        </div>
        <div className={row}>
          <dt className="label-caps">Password</dt>
          <dd className="data-id flex items-center gap-1 text-[16px] font-medium text-ink">
            {revealed ? (
              <>
                <span className="break-all">{revealed.password}</span>
                <CopyButton value={revealed.password} label="Copy password" />
              </>
            ) : (
              <span aria-label="Hidden" className="text-muted">
                {MASK}
              </span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {revealed ? (
          <Button variant="secondary" onClick={() => setRevealed(null)}>
            <EyeOff size={18} strokeWidth={1.5} aria-hidden />
            Hide now
          </Button>
        ) : (
          <Button onClick={reveal} loading={pending}>
            <Eye size={18} strokeWidth={1.5} aria-hidden />
            Reveal login details
          </Button>
        )}
        <ButtonLink href={`/dashboard/services/${serviceId}/rdp`} variant="secondary" prefetch={false} download>
          <Download size={18} strokeWidth={1.5} aria-hidden />
          Download .rdp file
        </ButtonLink>
        {revealed && (
          <p role="timer" className="num-tabular text-[13px] text-muted">
            Hides in {left}s
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="form-note mt-5" data-tone="error">
          {error}
        </p>
      )}

      <p className="mt-5 flex items-start gap-2.5 text-[13px] leading-relaxed text-muted">
        <KeyRound size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0" />
        <span>
          Showing login details is recorded for your security. The .rdp file for “{label}” contains the address and
          username only — your client asks for the password when you connect.
        </span>
      </p>
    </div>
  );
}
