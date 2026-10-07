"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, formAction } from "@/lib/action";
import { AppError, fromDbError } from "@/lib/errors";
import { checkUpload } from "@/lib/security/file-sniff";
import { checkbox, uuid } from "@/lib/validation";

const refresh = (ticketId: string) => {
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/tickets/${ticketId}`);
};

const MAX_ATTACHMENTS = 3;

/** A staff reply, or (internal=on) a note only staff can see. Files are sniffed server-side, same as the customer side. */
export const replyToTicket = formAction({
  name: "admin-ticket-reply",
  auth: "staff",
  rateLimit: { limit: 200, window: "1 h" },
  schema: z.object({
    ticketId: uuid,
    body: z.string().trim().min(2, "Write a message first.").max(10_000, "That message is too long."),
    internal: checkbox,
    attachments: z
      .array(z.instanceof(File))
      .optional()
      .transform((files) => (files ?? []).filter((f) => f.size > 0)),
  }),
  async handler({ ticketId, body, internal, attachments }, { supabase }) {
    if (attachments.length > MAX_ATTACHMENTS) {
      throw new AppError("VALIDATION", undefined, { fieldErrors: { attachments: [`You can attach up to ${MAX_ATTACHMENTS} files.`] } });
    }
    const stored: { path: string; name: string; mime: string; size: number }[] = [];
    for (const file of attachments) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const checked = checkUpload(bytes);
      if (!checked) {
        throw new AppError("UPLOAD_INVALID", undefined, {
          fieldErrors: { attachments: [`“${file.name}” can't be used. Attach a PNG, JPG, WebP or PDF under 5 MB.`] },
        });
      }
      const path = `${ticketId}/${crypto.randomUUID()}.${checked.ext}`;
      const up = await supabase.storage.from("ticket-attachments").upload(path, bytes, { contentType: checked.mime, upsert: false });
      if (up.error) throw new AppError("INTERNAL", undefined, { cause: up.error });
      stored.push({ path, name: file.name.slice(0, 120), mime: checked.mime, size: checked.size });
    }
    const { error } = await supabase.rpc("staff_reply_to_ticket", {
      p_ticket_id: ticketId,
      p_body: body,
      p_is_internal: internal,
      p_attachments: stored,
    });
    if (error) throw fromDbError(error);
    refresh(ticketId);
    return { sent: true as const, internal };
  },
});

export const setTicketFields = action({
  name: "admin-ticket-fields",
  auth: "staff",
  rateLimit: { limit: 300, window: "1 h" },
  schema: z.object({
    ticketId: uuid,
    status: z.enum(["open", "awaiting_customer", "resolved", "closed"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    category: z.enum(["billing", "technical", "order", "restart_request", "reinstall_request", "cannot_connect", "other"]).optional(),
  }),
  async handler({ ticketId, status, priority, category }, { supabase }) {
    const { error } = await supabase.rpc("set_ticket_fields", {
      p_ticket_id: ticketId,
      p_status: status ?? null,
      p_priority: priority ?? null,
      p_category: category ?? null,
    });
    if (error) throw fromDbError(error);
    refresh(ticketId);
    return { saved: true as const };
  },
});

export const assignTicket = action({
  name: "admin-ticket-assign",
  auth: "staff",
  rateLimit: { limit: 300, window: "1 h" },
  schema: z.object({ ticketId: uuid, assignee: z.union([z.literal(""), uuid]) }),
  async handler({ ticketId, assignee }, { supabase }) {
    const { error } = await supabase.rpc("assign_ticket", { p_ticket_id: ticketId, p_assignee: assignee || null });
    if (error) throw fromDbError(error);
    refresh(ticketId);
    return { saved: true as const };
  },
});

export const setMessageStatus = action({
  name: "admin-inbox-status",
  auth: "staff",
  rateLimit: { limit: 300, window: "1 h" },
  schema: z.object({ messageId: uuid, status: z.enum(["unread", "handled", "spam"]) }),
  async handler({ messageId, status }, { supabase }) {
    const { error } = await supabase.from("contact_messages").update({ status }).eq("id", messageId);
    if (error) throw fromDbError(error);
    revalidatePath("/admin", "layout");
    return { status };
  },
});
