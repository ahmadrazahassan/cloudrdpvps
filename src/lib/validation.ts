import { z } from "zod";

/** Reusable field schemas. Messages are written for the person filling the form. */

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address.")
  .max(254, "That email address is too long.")
  .pipe(z.email("Enter a valid email address."));

/** For NEW passwords. (Login accepts any non-empty string so old accounts can still get in.) */
export const newPassword = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use 128 characters or fewer.")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Include at least one letter and one number.");

export const fullName = z.string().trim().min(2, "Enter your name.").max(120, "That name is too long.");

/** Text input that may be left blank: "" becomes undefined. */
export const optionalText = (max: number, message = `Use ${max} characters or fewer.`) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

export const uuid = z.uuid("That doesn't look right. Refresh and try again.");

/** A uuid field that may be left empty ("" becomes undefined). */
export const optionalUuid = z
  .union([z.literal(""), uuid])
  .transform((v) => (v === "" ? undefined : v))
  .optional();

/** Checkbox as sent by <input type="checkbox">: "on" when ticked, absent otherwise. */
export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("1"), z.boolean()])
  .optional()
  .transform((v) => v === "on" || v === "true" || v === "1" || v === true);
