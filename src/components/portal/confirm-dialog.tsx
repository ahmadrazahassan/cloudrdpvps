"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action";

/**
 * Confirmation for destructive actions. The title restates the object ("Cancel order CRV-001042?")
 * so nobody confirms the wrong thing. Flat: same page colour, hairline border, no shadow.
 * `onConfirm` returns an ActionResult; on failure the message is shown inside the dialog.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Keep it",
  danger = true,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<ActionResult<unknown>>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function confirm() {
    setError(null);
    start(async () => {
      const result = await onConfirm();
      if (result.ok) setOpen(false);
      else setError(result.message);
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!pending) {
          setOpen(o);
          if (!o) setError(null);
        }
      }}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/30 data-[state=open]:animate-[fade-in_0.2s_ease-out]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-32px)] max-w-[460px] -translate-x-1/2 -translate-y-1/2 border border-line-2 bg-bg p-7 data-[state=open]:animate-[fade-in_0.15s_ease-out]">
          <Dialog.Title className="text-[20px] font-semibold tracking-[-0.016em] text-ink">{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className="mt-3 text-[15px] leading-relaxed text-ink-2">{description}</div>
          </Dialog.Description>
          {error && (
            <p role="alert" className="form-note mt-5" data-tone="error">
              {error}
            </p>
          )}
          <div className="mt-8 flex flex-wrap justify-end gap-3">
            <Dialog.Close asChild>
              <Button variant="secondary" disabled={pending}>
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button variant={danger ? "danger" : "primary"} loading={pending} onClick={confirm}>
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
