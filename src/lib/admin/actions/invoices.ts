"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/action";
import { fromDbError } from "@/lib/errors";
import { uuid } from "@/lib/validation";

/** Voiding keeps the invoice on record (status "void" with the reason) — nothing is deleted. */
export const voidInvoice = action({
  name: "admin-void-invoice",
  auth: "admin",
  rateLimit: { limit: 30, window: "1 h" },
  schema: z.object({ invoiceId: uuid, reason: z.string().trim().min(3, "Say why this invoice is being voided.").max(300) }),
  async handler({ invoiceId, reason }, { supabase }) {
    const { error } = await supabase.rpc("void_invoice", { p_invoice_id: invoiceId, p_reason: reason });
    if (error) throw fromDbError(error);
    revalidatePath("/admin/invoices");
    return { voided: true as const };
  },
});
