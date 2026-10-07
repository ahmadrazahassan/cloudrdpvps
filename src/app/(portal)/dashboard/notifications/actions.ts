"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/action";
import { fromDbError } from "@/lib/errors";

/** Marks the signed-in customer's unread notifications as read (row-level security limits it to their own rows). */
export const markAllNotificationsRead = action({
  name: "mark-notifications-read",
  auth: "user",
  rateLimit: { limit: 60, window: "1 h" },
  schema: z.object({}),
  async handler(_input, { supabase }) {
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    if (error) throw fromDbError(error);
    revalidatePath("/dashboard", "layout");
    return { done: true as const };
  },
});
