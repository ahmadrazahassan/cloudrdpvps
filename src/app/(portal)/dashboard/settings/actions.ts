"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { action, formAction } from "@/lib/action";
import { fromAuthError } from "@/lib/auth/errors";
import { COUNTRY_CODES } from "@/content/countries";
import { drainSoon, enqueueEmail } from "@/lib/email/queue";
import { publicEnv } from "@/lib/env";
import { AppError, fromDbError } from "@/lib/errors";
import { checkbox, email, fullName, newPassword, optionalText } from "@/lib/validation";

const PHONE = /^[+0-9 ()\-.]*$/;

export const updateProfile = formAction({
  name: "update-profile",
  auth: "user",
  rateLimit: { limit: 20, window: "1 h" },
  schema: z.object({
    fullName,
    phone: z
      .string()
      .trim()
      .max(32, "Use 32 characters or fewer.")
      .regex(PHONE, "Use digits, spaces and + ( ) - only.")
      .transform((v) => v || null),
    billingCountry: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => v === "" || COUNTRY_CODES.includes(v), "Choose a country from the list.")
      .transform((v) => v || null),
    company: optionalText(120),
    telegram: optionalText(64),
    whatsapp: optionalText(32),
  }),
  async handler(input, { supabase, user }) {
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: input.fullName,
        phone: input.phone,
        billing_country: input.billingCountry,
        company: input.company ?? null,
        telegram: input.telegram ?? null,
        whatsapp: input.whatsapp ?? null,
      })
      .eq("id", user!.id);
    if (error) throw fromDbError(error);
    revalidatePath("/dashboard", "layout");
    return { saved: true as const };
  },
});

export const changePassword = formAction({
  name: "change-password",
  auth: "user",
  rateLimit: { limit: 5, window: "15 m" },
  schema: z
    .object({ current: z.string().min(1, "Enter your current password.").max(256), password: newPassword, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match." }),
  async handler({ current, password }, { supabase, user }) {
    // Prove it's really them (a stolen session alone shouldn't be able to change the password).
    const check = await supabase.auth.signInWithPassword({ email: user!.email, password: current });
    if (check.error) {
      throw new AppError("VALIDATION", undefined, { fieldErrors: { current: ["Your current password is incorrect."] } });
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw fromAuthError(error);
    await supabase.auth.signOut({ scope: "others" });
    // Tell them, so a change they didn't make doesn't go unnoticed.
    if (await enqueueEmail({ userId: user!.id, to: user!.email, template: "password_changed", data: { at: new Date().toISOString() } })) drainSoon();
    return { changed: true as const };
  },
});

export const changeEmail = formAction({
  name: "change-email",
  auth: "user",
  rateLimit: { limit: 3, window: "1 h" },
  schema: z.object({ newEmail: email }),
  async handler({ newEmail }, { supabase, user }) {
    if (newEmail === user!.email.toLowerCase()) {
      throw new AppError("VALIDATION", undefined, { fieldErrors: { newEmail: ["That is already your email address."] } });
    }
    const { error } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: `${publicEnv.siteUrl}/auth/confirm?next=${encodeURIComponent("/dashboard/settings?tab=security")}` },
    );
    if (error) throw fromAuthError(error);
    return { sent: true as const };
  },
});

export const signOutEverywhere = action({
  name: "sign-out-everywhere",
  auth: "user",
  rateLimit: { limit: 5, window: "1 h" },
  schema: z.object({}),
  async handler(_input, { supabase }) {
    await supabase.auth.signOut({ scope: "global" });
    redirect("/login");
  },
});

export const updatePreferences = formAction({
  name: "update-preferences",
  auth: "user",
  rateLimit: { limit: 30, window: "1 h" },
  schema: z.object({ ticket_replies: checkbox, marketing: checkbox }),
  async handler(prefs, { supabase, user }) {
    const { error } = await supabase.from("profiles").update({ notification_prefs: prefs }).eq("id", user!.id);
    if (error) throw fromDbError(error);
    revalidatePath("/dashboard/settings");
    return { saved: true as const };
  },
});

/**
 * Deleting an account is done by a person, not a button: it opens a ticket so our team can check
 * nothing is owed and nothing is running first. Refused while a server is still active or suspended.
 */
export const requestAccountDeletion = formAction({
  name: "request-account-deletion",
  auth: "user",
  rateLimit: { limit: 3, window: "1 h" },
  schema: z.object({
    reason: optionalText(1000),
    confirm: checkbox.refine((v) => v, "Please confirm you want to request deletion."),
  }),
  async handler({ reason }, { supabase }) {
    const { count, error: countError } = await supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "suspended"]);
    if (countError) throw fromDbError(countError);
    if ((count ?? 0) > 0) {
      throw new AppError("CONFLICT", "You still have active servers. Let them expire (or ask us to terminate them) before requesting deletion.");
    }

    const { data, error } = await supabase.rpc("create_ticket", {
      p_subject: "Account deletion request",
      p_category: "other",
      p_service_id: null,
      p_message: `I would like my account and personal data deleted.${reason ? `\n\nReason: ${reason}` : ""}\n\n(Created from Settings → Account.)`,
    });
    if (error) throw fromDbError(error);
    revalidatePath("/dashboard/tickets");
    redirect(`/dashboard/tickets/${data.id}`);
  },
});
