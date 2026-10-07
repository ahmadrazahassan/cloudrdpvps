"use client";

import { Paperclip } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";
import { FormError, fieldError } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { replyToTicket, setTicketFields } from "@/lib/admin/actions/support";
import { cn } from "@/lib/utils";

/**
 * Reply to a customer, or write an internal note only staff can see. A canned response drops into the
 * message at the cursor (staff edit it before sending). Files are checked again on the server.
 */
export function TicketReply({ ticketId, canned }: { ticketId: string; canned: { id: string; title: string; body: string }[] }) {
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState(0);
  const [sentKey, setSentKey] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [closing, startClose] = useTransition();
  const [closeError, setCloseError] = useState<string | null>(null);

  // A successful send clears the box; bumping the key below also resets the file input.
  const [state, formAction, pending] = useActionState(async (prev: Awaited<ReturnType<typeof replyToTicket>> | null, fd: FormData) => {
    const result = await replyToTicket(prev, fd);
    if (result.ok) {
      setBody("");
      setFiles(0);
      setSentKey((k) => k + 1);
    }
    return result;
  }, null);

  function insert(text: string) {
    const el = area.current;
    if (!el) return setBody((b) => (b ? `${b}\n\n${text}` : text));
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + text + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  }

  return (
    <form key={sentKey} action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="ticketId" value={ticketId} />
      <FormError state={state} />
      <div className={cn("border-l-2 pl-4 transition-colors", internal ? "border-warn" : "border-lav-500")}>
        <label htmlFor="reply-body" className="mb-2 flex items-center justify-between gap-3 text-[14px] font-medium text-ink">
          <span>{internal ? <span className="text-warn">Internal note — the customer won&apos;t see this</span> : "Reply to the customer"}</span>
          {canned.length > 0 && (
            <select
              aria-label="Insert a saved reply"
              value=""
              onChange={(e) => {
                const hit = canned.find((c) => c.id === e.target.value);
                if (hit) insert(hit.body);
              }}
              className="h-8 max-w-[220px] rounded-btn border border-line-2 bg-transparent px-2 text-[13px] font-normal text-ink-2 outline-none hover:border-muted focus:border-lav-600"
            >
              <option value="">Saved replies…</option>
              {canned.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}
        </label>
        <textarea
          ref={area}
          id="reply-body"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          maxLength={10000}
          className="field-textarea !min-h-[140px]"
          aria-invalid={fieldError(state, "body") ? true : undefined}
        />
        {fieldError(state, "body") && <p className="field-error">{fieldError(state, "body")![0]}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="check !items-center">
          <input type="checkbox" name="internal" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="!mt-0" />
          <span>Internal note</span>
        </label>
        <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-lav-700 hover:text-lav-900">
          <Paperclip size={15} strokeWidth={1.5} aria-hidden />
          {files > 0 ? `${files} file${files === 1 ? "" : "s"} attached` : "Attach files"}
        </button>
        <input
          ref={fileInput}
          type="file"
          name="attachments[]"
          multiple
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="sr-only"
          tabIndex={-1}
          aria-label="Attachments"
          onChange={(e) => setFiles(e.target.files?.length ?? 0)}
        />
        {fieldError(state, "attachments") && <span className="field-error !mt-0">{fieldError(state, "attachments")![0]}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending} disabled={!body.trim()}>
          {internal ? "Add internal note" : "Send reply"}
        </Button>
        {!internal && (
          <Button
            type="button"
            variant="secondary"
            loading={closing}
            onClick={() =>
              startClose(async () => {
                setCloseError(null);
                const r = await setTicketFields({ ticketId, status: "resolved" });
                if (!r.ok) setCloseError(r.message);
              })
            }
          >
            Mark resolved
          </Button>
        )}
        {closeError && <span className="field-error !mt-0">{closeError}</span>}
      </div>
    </form>
  );
}
