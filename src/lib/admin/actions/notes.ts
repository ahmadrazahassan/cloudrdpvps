"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/action";
import { fromDbError } from "@/lib/errors";
import { uuid } from "@/lib/validation";

/** An internal note on a customer, order or service. Staff only; customers never see these. */
export const addNote = action({
  name: "admin-add-note",
  auth: "staff",
  rateLimit: { limit: 120, window: "1 h" },
  schema: z.object({
    entityType: z.enum(["customer", "order", "service"]),
    entityId: uuid,
    body: z.string().trim().min(1, "Write a note first.").max(5000, "Keep notes under 5,000 characters."),
  }),
  async handler({ entityType, entityId, body }, { supabase, user }) {
    const { error } = await supabase.from("staff_notes").insert({ entity_type: entityType, entity_id: entityId, author_id: user!.id, body });
    if (error) throw fromDbError(error);
    revalidatePath(`/admin/${entityType === "customer" ? "customers" : entityType === "order" ? "orders" : "services"}/${entityId}`);
    return { saved: true as const };
  },
});
