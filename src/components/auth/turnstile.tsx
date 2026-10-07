"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: { sitekey: string; theme?: "light" | "dark" | "auto"; appearance?: string }) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

// Inlined at build time (static access) — no need to pull the env parser into the browser bundle.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Cloudflare Turnstile bot check. Renders nothing when no site key is configured.
 * Inside a <form>, the widget adds a hidden `cf-turnstile-response` field that the server action verifies.
 * Tokens are single-use, so pass something that changes after each submit as `resetKey`.
 */
export function Turnstile({
  resetKey,
  theme = "light",
  className = "min-h-[65px]",
}: {
  resetKey?: unknown;
  /** Match the surface the widget sits on. */
  theme?: "light" | "dark";
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

  const mount = useCallback(() => {
    if (!SITE_KEY || !container.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(container.current, { sitekey: SITE_KEY, theme });
  }, [theme]);

  useEffect(() => {
    mount(); // the script may already be loaded (client-side navigation)
    return () => {
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, [mount]);

  useEffect(() => {
    if (resetKey !== undefined && widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={mount}
      />
      <div ref={container} className={className} />
    </>
  );
}
