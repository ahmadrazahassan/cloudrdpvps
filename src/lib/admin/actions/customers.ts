"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/action";
import { fromDbError } from "@/lib/errors";
import { SUSPEND_REASONS } from "../reasons";
import { optionalText, uuid } from "@/lib/validation";

export const setCustomerStatus = action({
  name: "admin-set-account-status",
  notifies: true,
  auth: "admin",
  rateLimit: { limit: 60, window: "1 h" },
  schema: z.object({
    userId: uuid,
    status: z.enum(["active", "suspended"]),
    reason: z.enum(SUSPEND_REASONS).optional(),
    detail: optionalText(300),
  }),
  async handler({ userId, status, reason, detail }, { supabase }) {
    const text = reason ? (detail ? `${reason}: ${detail}` : reason) : null;
    const { error } = await supabase.rpc("set_account_status", { p_user_id: userId, p_status: status, p_reason: text });
    if (error) throw fromDbError(error);
    revalidatePath("/admin", "layout");
    revalidatePath(`/admin/customers/${userId}`);
    return { status };
  },
});
