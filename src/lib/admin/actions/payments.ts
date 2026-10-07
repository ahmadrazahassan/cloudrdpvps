"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/action";
import { AppError, fromDbError } from "@/lib/errors";
import { optionalText, uuid } from "@/lib/validation";
import { parseUsdToCents } from "../money";
import { REJECT_REASONS } from "../reasons";

const refresh = () => revalidatePath("/admin", "layout");

/**
 * Approve a payment proof. The database function does the real work in one transaction — payment
 * verified, invoice issued, order approved (or, for a renewal, the server extended), customer notified,
 * audit row written — and refuses unless the amount received covers the order total.
 */
export const approvePayment = action({
  name: "admin-approve-payment",
  auth: "admin",
  rateLimit: { limit: 200, window: "1 h" },
  schema: z.object({ paymentId: uuid, received: z.string().trim().min(1, "Enter the amount you received.") }),
  async handler({ paymentId, received }, { supabase }) {
    const cents = parseUsdToCents(received);
    if (cents === null || cents <= 0) {
      throw new AppError("VALIDATION", undefined, { fieldErrors: { received: ["Enter an amount like 25.00."] } });
    }
    const { data, error } = await supabase.rpc("approve_payment", { p_payment_id: paymentId, p_received_usd_cents: cents });
    if (error) throw fromDbError(error);
    refresh();
    return { orderId: data.id, orderNumber: data.order_number, type: data.type, status: data.status };
  },
});

export const rejectPayment = action({
  name: "admin-reject-payment",
  auth: "admin",
  rateLimit: { limit: 200, window: "1 h" },
  schema: z.object({
    paymentId: uuid,
    reason: z.enum(REJECT_REASONS, { error: "Choose a reason." }),
    message: optionalText(500),
  }),
  async handler({ paymentId, reason, message }, { supabase }) {
    if (reason === "Other" && !message) {
      throw new AppError("VALIDATION", undefined, { fieldErrors: { message: ["Tell the customer what went wrong."] } });
    }
    const { error } = await supabase.rpc("reject_payment", { p_payment_id: paymentId, p_reason: reason, p_message: message ?? null });
    if (error) throw fromDbError(error);
    refresh();
    return { rejected: true as const };
  },
});
