"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { action, formAction } from "@/lib/action";
import { AppError, fromDbError } from "@/lib/errors";
import { checkUpload } from "@/lib/security/file-sniff";
import { optionalUuid, uuid } from "@/lib/validation";
import { TICKET_CATEGORIES } from "./categories";

const MAX_ATTACHMENTS = 3;

export const createTicket = formAction({
  name: "create-ticket",
  notifies: true,
  auth: "user",
  rateLimit: { limit: 10, window: "1 h" },
  schema: z.object({
    subject: z.string().trim().min(3, "Give your ticket a short subject.").max(200, "Use 200 characters or fewer."),
    category: z.enum(TICKET_CATEGORIES.map((c) => c.value) as [string, ...string[]], "Choose a category."),
    serviceId: optionalUuid,
    message: z.string().trim().min(20, "Please describe the problem in at least 20 characters.").max(10_000, "That message is too long."),
  }),
  async handler({ subject, category, serviceId, message }, { supabase }) {
    const { data, error } = await supabase.rpc("create_ticket", {
      p_subject: subject,
      p_category: category as (typeof TICKET_CATEGORIES)[number]["value"],
      p_service_id: serviceId ?? null,
      p_message: message,
    });
    if (error) throw fromDbError(error);
    revalidatePath("/dashboard/tickets");
    revalidatePath("/dashboard");
    redirect(`/dashboard/tickets/${data.id}`);
  },
});

/** Replies can carry up to three files. Each is content-checked, then stored under the ticket's own folder. */
export const replyToTicket = formAction({
  name: "reply-to-ticket",
  notifies: true,
  auth: "user",
  rateLimit: { limit: 30, window: "1 h" },
  schema: z.object({
    ticketId: uuid,
    body: z.string().trim().min(2, "Write a message first.").max(10_000, "That message is too long."),
    attachments: z
      .array(z.instanceof(File))
      .optional()
      .transform((files) => (files ?? []).filter((f) => f.size > 0)),
  }),
  async handler({ ticketId, body, attachments }, { supabase }) {
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

    const { error } = await supabase.rpc("reply_to_ticket", { p_ticket_id: ticketId, p_body: body, p_attachments: stored });
    if (error) throw fromDbError(error);

    revalidatePath(`/dashboard/tickets/${ticketId}`);
    revalidatePath("/dashboard/tickets");
    revalidatePath("/dashboard");
    return { sent: true as const };
  },
});

export const setTicketStatus = action({
  name: "set-ticket-status",
  auth: "user",
  rateLimit: { limit: 30, window: "1 h" },
  schema: z.object({ ticketId: uuid, status: z.enum(["resolved", "open"]) }),
  async handler({ ticketId, status }, { supabase }) {
    const { error } = await supabase.rpc("set_ticket_status_customer", { p_ticket_id: ticketId, p_status: status });
    if (error) throw fromDbError(error);
    revalidatePath(`/dashboard/tickets/${ticketId}`);
    revalidatePath("/dashboard/tickets");
    revalidatePath("/dashboard");
    return { status };
  },
});
