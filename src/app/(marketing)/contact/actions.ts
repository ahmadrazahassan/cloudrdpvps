"use server";

import { isIP } from "node:net";
import { z } from "zod";
import { formAction } from "@/lib/action";
import { AppError, fromDbError } from "@/lib/errors";
import { serverEnv } from "@/lib/env.server";
import { getUserAgent } from "@/lib/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { email, fullName } from "@/lib/validation";
import { CONTACT_TOPICS } from "./topics";

/**
 * Public contact form. There is deliberately no anonymous INSERT policy on
 * `contact_messages`: the row is written here with the service role, after the
 * Turnstile check and the per-IP rate limit that `formAction` applies.
 */
export const submitContactForm = formAction({
  name: "contact",
  auth: "public",
  captcha: true,
  rateLimit: { limit: 5, window: "1 h" },
  schema: z.object({
    name: fullName,
    email,
    topic: z.enum(CONTACT_TOPICS.map((t) => t.value) as [string, ...string[]], "Choose what this is about."),
    message: z
      .string()
      .trim()
      .min(10, "Please write at least 10 characters.")
      .max(5000, "Please keep your message under 5,000 characters."),
    // Honeypot: real visitors never see or fill this field.
    website: z.string().max(200).optional(),
  }),
  async handler({ name, email: address, topic, message, website }, { ip }) {
    // A bot filled the hidden field. Say "sent" and store nothing, so it learns nothing.
    if (website) return { sent: true as const };

    if (!serverEnv().SUPABASE_SERVICE_ROLE_KEY) {
      throw new AppError(
        "UNAVAILABLE",
        "We can't take messages through this form right now. If you have an account, open a ticket from your dashboard instead.",
      );
    }

    const { error } = await createAdminClient()
      .from("contact_messages")
      .insert({
        name,
        email: address,
        topic,
        message,
        ip: isIP(ip) ? ip : null,
        user_agent: await getUserAgent(),
      });
    if (error) throw fromDbError(error);

    return { sent: true as const };
  },
});
