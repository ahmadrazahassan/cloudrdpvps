"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { WHATSAPP_GREEN, WhatsAppLogo } from "@/components/brand/whatsapp-logo";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MESSAGE_MAX, whatsAppChatUrl, whatsAppMessage, type WhatsAppTarget } from "@/lib/whatsapp";

/**
 * The floating WhatsApp chat: a round launcher in the corner that opens a small panel with one thing in it — a
 * message box. Write, send, and WhatsApp opens in a new tab with it already typed and the page the visitor is on
 * attached. Deliberately minimal: no menus or FAQ-style topics, on phones and on laptops alike.
 * Chatting happens in WhatsApp itself (the visitor's own app, history and notifications); we don't proxy it.
 *
 * Opens per page: navigating closes it (the open state remembers which path it was opened on). Esc, the close
 * button or a tap outside close it; Esc and the button hand focus back to the launcher.
 */
export function WhatsAppWidget({ siteName, siteUrl, target }: { siteName: string; siteUrl: string; target: WhatsAppTarget }) {
  const pathname = usePathname() ?? "/";
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const open = openedAt === pathname;

  const root = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();
  const fieldId = useId();

  useEffect(() => {
    if (!open) return;
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenedAt(null);
      launcher.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpenedAt(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const pageUrl = `${siteUrl}${pathname}`;
  const chatLink = (text: string) => whatsAppChatUrl(target, whatsAppMessage({ siteName, text, pageUrl }));
  const closeAfterOpening = () => setOpenedAt(null);

  return (
    <div
      ref={root}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-50 flex flex-col-reverse items-end gap-3 print:hidden"
    >
      <button
        ref={launcher}
        type="button"
        aria-label={open ? "Close WhatsApp chat" : "Chat with us on WhatsApp"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpenedAt(open ? null : pathname)}
        style={{ backgroundColor: WHATSAPP_GREEN }}
        className="relative grid h-[60px] w-[60px] place-items-center rounded-full text-white shadow-[0_12px_28px_-10px_rgb(7_94_84/0.65),0_2px_6px_rgb(18_18_20/0.18)] transition-transform duration-200 hover:scale-[1.06] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lav-600 active:scale-95 motion-reduce:transition-none"
      >
        {/* A few soft rings on arrival to say "we're here", then it stays still. */}
        {!open && (
          <span
            aria-hidden
            style={{ backgroundColor: WHATSAPP_GREEN }}
            className="absolute inset-0 rounded-full opacity-0 motion-safe:animate-[wa-ring_2.4s_ease-out_1.5s_3_both]"
          />
        )}
        <WhatsAppLogo
          className={cn("relative h-[34px] w-[34px] transition-[opacity,transform] duration-200 motion-reduce:transition-none", open && "scale-50 opacity-0")}
        />
        <X
          aria-hidden
          strokeWidth={2}
          className={cn("absolute h-7 w-7 transition-[opacity,transform] duration-200 motion-reduce:transition-none", !open && "scale-50 opacity-0")}
        />
      </button>

      {open && (
        <div
          ref={panel}
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="max-h-[calc(100dvh-7.5rem)] w-[calc(100vw-2rem)] max-w-[380px] overflow-y-auto overscroll-contain rounded-panel border border-line-2 bg-bg p-5 shadow-[0_28px_70px_-24px_rgb(18_18_20/0.45)] focus:outline-none motion-safe:animate-[wa-in_0.2s_ease-out]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <WhatsAppLogo className="mt-[3px] h-7 w-7 shrink-0" style={{ color: WHATSAPP_GREEN }} />
              <div>
                <h2 id={titleId} className="font-display text-[21px] font-normal leading-snug tracking-[-0.015em] text-ink">
                  Message us on WhatsApp
                </h2>
                <p className="mt-0.5 text-[14.5px] leading-snug text-ink-2">Our team replies in the chat.</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => {
                setOpenedAt(null);
                launcher.current?.focus();
              }}
              className="-mr-2 -mt-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-btn text-ink hover:bg-black/[0.05]"
            >
              <X size={20} strokeWidth={1.5} aria-hidden />
            </button>
          </div>

          <label htmlFor={fieldId} className="sr-only">
            Your message
          </label>
          <textarea
            id={fieldId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MESSAGE_MAX}
            rows={3}
            placeholder="Write your message…"
            className="field-textarea mt-5 min-h-24"
          />

          <a
            href={chatLink(draft)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeAfterOpening}
            className={buttonClasses({ variant: "dark", size: "lg", className: "mt-3 w-full" })}
          >
            <WhatsAppLogo className="h-5 w-5" style={{ color: WHATSAPP_GREEN }} />
            Send on WhatsApp
          </a>
          <p className="mt-3 text-[12.5px] leading-snug text-muted">Opens WhatsApp. We include the page you&apos;re on.</p>
        </div>
      )}
    </div>
  );
}
