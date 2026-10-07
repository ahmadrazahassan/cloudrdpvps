"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, formAction } from "@/lib/action";
import { AppError, fromDbError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptCredential } from "@/lib/security/credentials";
import { checkbox, optionalText, uuid } from "@/lib/validation";
import { parseUsdToCents } from "../money";
import { CANCEL_REASONS, REFUND_REASONS } from "../reasons";

const refresh = (orderId?: string) => {
  revalidatePath("/admin", "layout");
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
};

export const startProvisioning = action({
  name: "admin-start-provisioning",
  auth: "admin",
  rateLimit: { limit: 200, window: "1 h" },
  schema: z.object({ orderId: uuid }),
  async handler({ orderId }, { supabase }) {
    const { error } = await supabase.rpc("start_provisioning", { p_order_id: orderId });
    if (error) throw fromDbError(error);
    refresh(orderId);
    return { started: true as const };
  },
});

export const cancelOrder = action({
  name: "admin-cancel-order",
  auth: "admin",
  rateLimit: { limit: 100, window: "1 h" },
  schema: z.object({ orderId: uuid, reason: z.enum(CANCEL_REASONS, { error: "Choose a reason." }), detail: optionalText(300) }),
  async handler({ orderId, reason, detail }, { supabase }) {
    const { error } = await supabase.rpc("admin_cancel_order", { p_order_id: orderId, p_reason: detail ? `${reason}: ${detail}` : reason });
    if (error) throw fromDbError(error);
    refresh(orderId);
    return { cancelled: true as const };
  },
});

/** Refunds are paid outside the system (payments are manual); this records that one was made. */
export const refundOrder = action({
  name: "admin-refund-order",
  auth: "admin",
  rateLimit: { limit: 60, window: "1 h" },
  schema: z.object({
    orderId: uuid,
    amount: z.string().trim().min(1, "Enter the amount refunded."),
    reason: z.enum(REFUND_REASONS, { error: "Choose a reason." }),
    detail: optionalText(300),
  }),
  async handler({ orderId, amount, reason, detail }, { supabase }) {
    const cents = parseUsdToCents(amount);
    if (cents === null || cents <= 0) {
      throw new AppError("VALIDATION", undefined, { fieldErrors: { amount: ["Enter an amount like 25.00."] } });
    }
    const { error } = await supabase.rpc("mark_order_refunded", {
      p_order_id: orderId,
      p_amount_cents: cents,
      p_reason: detail ? `${reason}: ${detail}` : reason,
    });
    if (error) throw fromDbError(error);
    refresh(orderId);
    return { refunded: true as const };
  },
});

const hostSchema = z.union([z.ipv4("Enter a valid IPv4 or IPv6 address."), z.ipv6("Enter a valid IPv4 or IPv6 address.")]);

const deliverSchema = z
  .object({
    orderId: uuid,
    source: z.enum(["manual", "inventory"]),
    inventoryItemId: z.union([z.literal(""), uuid]).optional(),
    label: optionalText(60),
    hostname: optionalText(120),
    ip: z.string().trim().optional(),
    port: z.coerce.number().int("Use a whole number.").min(1, "Ports go from 1 to 65535.").max(65535, "Ports go from 1 to 65535.").default(3389),
    username: z.string().trim().max(104, "That username is too long.").optional(),
    password: z.string().max(128, "Use 128 characters or fewer.").optional(),
    startsAt: z.union([z.literal(""), z.iso.datetime({ offset: true })]).optional(),
    expiresAt: z.union([z.literal(""), z.iso.datetime({ offset: true })]).optional(),
    expiryReason: optionalText(300),
    notify: checkbox,
    note: optionalText(2000),
  })
  .superRefine((v, ctx) => {
    if (v.source === "inventory") {
      if (!v.inventoryItemId) ctx.addIssue({ code: "custom", path: ["inventoryItemId"], message: "Pick a server from stock." });
      return;
    }
    if (!v.ip || !hostSchema.safeParse(v.ip).success) ctx.addIssue({ code: "custom", path: ["ip"], message: "Enter a valid IPv4 or IPv6 address." });
    if (!v.username) ctx.addIssue({ code: "custom", path: ["username"], message: "Enter the Windows username." });
    if (!v.password || v.password.length < 8) ctx.addIssue({ code: "custom", path: ["password"], message: "Use at least 8 characters." });
  });

/**
 * Deliver a server for an approved order. The password is encrypted here, on the server, before it
 * goes anywhere near the database; the allocate function then creates the service, stores the
 * ciphertext, completes the order, notifies the customer (the email never carries the password)
 * and writes the audit row — all in one transaction.
 */
export const deliverServer = formAction({
  name: "admin-deliver-server",
  notifies: true,
  auth: "admin",
  rateLimit: { limit: 120, window: "1 h" },
  schema: deliverSchema,
  async handler(v, { supabase, user }) {
    let ip = v.ip ?? "";
    let port = v.port;
    let username = v.username ?? "";
    let passwordEnc: string;
    let inventoryItemId: string | null = null;

    if (v.source === "inventory") {
      // The stored password is not selectable by clients (column grants), so read it with the service role —
      // only after the role check above, and only the one row the admin picked.
      const { data: item, error } = await createAdminClient()
        .from("inventory_items")
        .select("id, ip, rdp_port, username, password_enc, status")
        .eq("id", v.inventoryItemId!)
        .maybeSingle();
      if (error || !item) throw new AppError("NOT_FOUND");
      if (item.status !== "available") throw new AppError("CONFLICT");
      ip = String(item.ip).split("/")[0]!;
      port = item.rdp_port;
      username = item.username;
      passwordEnc = item.password_enc;
      inventoryItemId = item.id;
    } else {
      passwordEnc = encryptCredential(v.password!);
    }

    const { data: service, error } = await supabase.rpc("allocate_service", {
      p_order_id: v.orderId,
      p_label: v.label ?? null,
      p_hostname: v.hostname ?? null,
      p_ip: ip,
      p_port: port,
      p_username: username,
      p_password_enc: passwordEnc,
      p_starts_at: v.startsAt || null,
      p_expires_at: v.expiresAt || null,
      p_inventory_item_id: inventoryItemId,
      p_expiry_reason: v.expiryReason ?? null,
      p_notify: v.notify,
    });
    if (error) throw fromDbError(error);

    if (v.note) {
      await supabase.from("staff_notes").insert({ entity_type: "service", entity_id: service.id, author_id: user!.id, body: v.note });
    }
    refresh(v.orderId);
    revalidatePath("/admin/services");
    return { serviceId: service.id, label: service.label };
  },
});
