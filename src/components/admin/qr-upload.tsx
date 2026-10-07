"use client";

import { useActionState } from "react";
import { fieldError } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { uploadMethodQr } from "@/lib/admin/actions/catalog";

/** Choose an image and upload it as the method's QR code. */
export function QrUpload({ id, hasQr }: { id: string; hasQr: boolean }) {
  const [state, formAction, pending] = useActionState(uploadMethodQr, null);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`qr-${id}`}>
        QR code image
      </label>
      <input id={`qr-${id}`} type="file" name="file" accept="image/png,image/jpeg,image/webp" required className="max-w-[210px] text-[12.5px] text-ink-2 file:mr-2 file:cursor-pointer file:rounded-btn file:border file:border-line-2 file:bg-transparent file:px-2.5 file:py-1.5 file:text-[12.5px] file:font-medium file:text-ink" />
      <Button type="submit" size="sm" variant="secondary" loading={pending}>
        {hasQr ? "Replace QR" : "Upload QR"}
      </Button>
      {state?.ok && <span role="status" className="text-[12.5px] text-ok">Saved</span>}
      {state && !state.ok && <span role="alert" className="field-error !mt-0">{fieldError(state, "file")?.[0] ?? state.message}</span>}
    </form>
  );
}
