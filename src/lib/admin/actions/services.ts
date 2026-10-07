"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "@/lib/action";
import { AppError, fromDbError } from "@/lib/errors";
import { decryptCredential, encryptCredential } from "@/lib/security/credentials";
import { checkbox, optionalText, uuid } from "@/lib/validation";
import { EXTEND_REASONS, SUSPEND_REASONS } from "../reasons";

const refresh = (serviceId: string) => {
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/services/${serviceId}`);
};

const reasonText = (reason: string, detail?: string) => (detail ? `${reason}: ${detail}` : reason);

/** +30 days (the standard term, no reason needed), +N days, or an exact date — the last two need a reason. */
export const extendService = action({
  name: "admin-extend-service",
  auth: "admin",
  rateLimit: { limit: 120, window: "1 h" },
  schema: z
    .object({
      serviceId: uuid,
      mode: z.enum(["term", "days", "date"]),
      days: z.coerce.number().int("Use whole days.").min(1, "At least 1 day.").max(3650, "Up to 3,650 days.").optional(),
      date: z.iso.datetime({ offset: true }).optional(),
      reason: z.enum(EXTEND_REASONS).optional(),
      detail: optionalText(300),
    })
    .superRefine((v, ctx) => {
      if (v.mode === "days" && !v.days) ctx.addIssue({ code: "custom", path: ["days"], message: "Enter the number of days." });
      if (v.mode === "date" && !v.date) ctx.addIssue({ code: "custom", path: ["date"], message: "Pick the new expiry date." });
      if (v.mode !== "term" && !v.reason) ctx.addIssue({ code: "custom", path: ["reason"], message: "Choose a reason." });
    }),
  async handler(v, { supabase }) {
    const { data, error } = await supabase.rpc("extend_service", {
      p_service_id: v.serviceId,
      // the term length lives in the database (public.term_days()); "term" sends 30 and the function accepts it without a reason
      p_days: v.mode === "term" ? 30 : v.mode === "days" ? v.days! : null,
      p_set_expires_at: v.mode === "date" ? v.date! : null,
      p_reason: v.reason ? reasonText(v.reason, v.detail) : null,
    });
    if (error) throw fromDbError(error);
    refresh(v.serviceId);
    return { expiresAt: data.expires_at };
  },
});

export const suspendService = action({
  name: "admin-suspend-service",
  auth: "admin",
  rateLimit: { limit: 60, window: "1 h" },
  schema: z.object({ serviceId: uuid, reason: z.enum(SUSPEND_REASONS, { error: "Choose a reason." }), detail: optionalText(300) }),
  async handler({ serviceId, reason, detail }, { supabase }) {
    const { error } = await supabase.rpc("suspend_service", { p_service_id: serviceId, p_reason: reasonText(reason, detail) });
    if (error) throw fromDbError(error);
    refresh(serviceId);
    return { suspended: true as const };
  },
});

export const unsuspendService = action({
  name: "admin-unsuspend-service",
  auth: "admin",
  rateLimit: { limit: 60, window: "1 h" },
  schema: z.object({ serviceId: uuid }),
  async handler({ serviceId }, { supabase }) {
    const { error } = await supabase.rpc("unsuspend_service", { p_service_id: serviceId });
    if (error) throw fromDbError(error);
    refresh(serviceId);
    return { restored: true as const };
  },
});

/** Terminating deletes the stored login and retires the inventory item. The label must be typed to confirm. */
export const terminateService = action({
  name: "admin-terminate-service",
  auth: "admin",
  rateLimit: { limit: 30, window: "1 h" },
  schema: z.object({
    serviceId: uuid,
    reason: z.string().trim().min(3, "Say why this server is being terminated.").max(300),
    typed: z.string().trim(),
    label: z.string().trim(),
  }),
  async handler({ serviceId, reason, typed, label }, { supabase }) {
    if (typed !== label) {
      throw new AppError("VALIDATION", undefined, { fieldErrors: { typed: ["That doesn't match the server's name."] } });
    }
    const { error } = await supabase.rpc("terminate_service", { p_service_id: serviceId, p_reason: reason });
    if (error) throw fromDbError(error);
    refresh(serviceId);
    return { terminated: true as const };
  },
});

export const updateCredentials = action({
  name: "admin-update-credentials",
  auth: "admin",
  rateLimit: { limit: 60, window: "1 h" },
  schema: z.object({
    serviceId: uuid,
    username: z.string().trim().min(1, "Enter the Windows username.").max(104, "That username is too long."),
    password: z.string().min(8, "Use at least 8 characters.").max(128, "Use 128 characters or fewer."),
    notify: checkbox,
  }),
  async handler({ serviceId, username, password, notify }, { supabase }) {
    const { error } = await supabase.rpc("update_service_credentials", {
      p_service_id: serviceId,
      p_username: username,
      p_password_enc: encryptCredential(password),
      p_notify: notify,
    });
    if (error) throw fromDbError(error);
    refresh(serviceId);
    return { updated: true as const };
  },
});

/** Admin-only reveal. The database function audits every call (`credentials.reveal.admin`); the plaintext is decrypted here and returned once. */
export const revealCredentialsAdmin = action({
  name: "admin-reveal-credentials",
  auth: "admin",
  rateLimit: { limit: 20, window: "10 m" },
  schema: z.object({ serviceId: uuid }),
  async handler({ serviceId }, { supabase }) {
    const { data, error } = await supabase.rpc("get_service_credentials", { p_service_id: serviceId });
    if (error) throw fromDbError(error);
    const row = data?.[0];
    if (!row?.username || !row.password_enc) throw new AppError("NOT_FOUND");
    let password: string;
    try {
      password = decryptCredential(row.password_enc);
    } catch (cause) {
      throw new AppError("INTERNAL", undefined, { cause });
    }
    return { username: row.username, password, expiresAt: Date.now() + 30_000 };
  },
});
