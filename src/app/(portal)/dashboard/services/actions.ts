"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/action";
import { AppError, fromDbError } from "@/lib/errors";
import { decryptCredential } from "@/lib/security/credentials";
import { uuid } from "@/lib/validation";

/** How long the plaintext password stays visible in the browser before it masks itself. */
const REVEAL_MS = 30_000;

/**
 * Shows a server's login details to its owner. The database function checks ownership, that the
 * account is active and that the server is genuinely active, and writes an audit-log row on every
 * call; only then is the stored ciphertext decrypted here, on the server. The plaintext goes back
 * in this one response and is never logged, cached or put in a URL.
 */
export const revealCredentials = action({
  name: "reveal-credentials",
  auth: "user",
  rateLimit: { limit: 10, window: "10 m" },
  schema: z.object({ serviceId: uuid }),
  async handler({ serviceId }, { supabase }) {
    const { data, error } = await supabase.rpc("get_service_credentials", { p_service_id: serviceId });
    if (error) throw fromDbError(error);
    const row = data?.[0];
    // (Table-returning functions are typed with nullable columns; both are NOT NULL in the table.)
    if (!row?.username || !row.password_enc) throw new AppError("NOT_FOUND");

    let password: string;
    try {
      password = decryptCredential(row.password_enc);
    } catch (cause) {
      // A wrong or missing key must be loud for the operator but reveal nothing to the customer.
      throw new AppError("INTERNAL", undefined, { cause });
    }
    return { username: row.username, password, expiresAt: Date.now() + REVEAL_MS };
  },
});

export const renameService = action({
  name: "rename-service",
  auth: "user",
  rateLimit: { limit: 30, window: "1 h" },
  schema: z.object({
    serviceId: uuid,
    label: z.string().trim().min(1, "Enter a name.").max(60, "Use 60 characters or fewer."),
  }),
  async handler({ serviceId, label }, { supabase }) {
    const { error } = await supabase.rpc("rename_service", { p_service_id: serviceId, p_label: label });
    if (error) throw fromDbError(error);
    revalidatePath("/dashboard/services");
    revalidatePath(`/dashboard/services/${serviceId}`);
    revalidatePath("/dashboard");
    return { label };
  },
});
