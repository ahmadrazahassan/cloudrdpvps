"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { action, formAction } from "@/lib/action";
import { AppError, fromDbError } from "@/lib/errors";
import { checkbox, optionalText, optionalUuid, uuid } from "@/lib/validation";

/**
 * "Does this coupon work here, and what would the total be?" — advice shown before the order is placed.
 * It runs the same rules as `create_order` (a database function) without writing anything, so it is open to
 * visitors who aren't signed in; `create_order` still decides the real total when the order is placed.
 */
export const previewCoupon = action({
  name: "preview-coupon",
  auth: "public",
  rateLimit: { limit: 30, window: "10 m" },
  schema: z.object({ planId: uuid, locationId: uuid, code: z.string().trim().min(1, "Enter a coupon code.").max(40, "That code is too long.") }),
  async handler({ planId, locationId, code }, { supabase }) {
    const { data, error } = await supabase.rpc("preview_coupon", { p_plan_id: planId, p_location_id: locationId, p_code: code });
    if (error) throw fromDbError(error);
    const row = data?.[0];
    if (!row || row.discount_cents == null || row.total_cents == null) throw new AppError("COUPON_INVALID");
    return { code, discountCents: row.discount_cents, totalCents: row.total_cents };
  },
});

/**
 * Places the order. The browser only says WHICH plan, WHERE and which coupon code;
 * `create_order` (a database function) looks up the price, checks stock and the
 * coupon, snapshots everything on the order and enforces the open-order limit. Nothing
 * about money is accepted from the form.
 */
export const placeOrder = formAction({
  name: "place-order",
  auth: "user",
  rateLimit: { limit: 10, window: "1 h" },
  schema: z.object({
    planId: uuid,
    locationId: uuid,
    renewServiceId: optionalUuid,
    coupon: optionalText(40),
    terms: checkbox.refine((v) => v, "Please accept the Terms and the Acceptable Use Policy."),
  }),
  async handler({ planId, locationId, renewServiceId, coupon }, { supabase }) {
    const { data, error } = await supabase.rpc("create_order", {
      p_plan_id: planId,
      p_location_id: locationId,
      p_coupon_code: coupon,
      p_renew_service_id: renewServiceId,
    });
    if (error) throw fromDbError(error);
    redirect(`/dashboard/orders/${data.id}/pay`);
  },
});
