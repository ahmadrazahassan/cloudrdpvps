"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, formAction } from "@/lib/action";
import { AppError, fromDbError } from "@/lib/errors";
import { serverEnv } from "@/lib/env.server";
import { checkUpload } from "@/lib/security/file-sniff";
import { createAdminClient } from "@/lib/supabase/admin";
import { optionalText, uuid } from "@/lib/validation";

const refresh = (orderId: string) => {
  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath(`/dashboard/orders/${orderId}/pay`);
  revalidatePath("/dashboard");
};

/**
 * Payment proof. The browser sends the file inside the form; the server checks what the file
 * REALLY is (magic bytes, not the filename or the type the browser claims) and its size before
 * anything is stored, fingerprints it (SHA-256, so the same screenshot can't be reused on another
 * order unnoticed), uploads it into the customer's own private folder, and then calls
 * `submit_payment`, which records the payment and moves the order to "under review".
 */
export const submitPaymentProof = formAction({
  name: "submit-payment",
  auth: "user",
  rateLimit: { limit: 20, window: "1 h" },
  schema: z.object({
    orderId: uuid,
    methodId: uuid,
    reference: optionalText(200),
    note: optionalText(1000),
    proof: z.instanceof(File, { message: "Choose a file to upload." }),
  }),
  async handler({ orderId, methodId, reference, note, proof }, { supabase, user }) {
    if (!proof.size) {
      throw new AppError("VALIDATION", undefined, { fieldErrors: { proof: ["Choose a file to upload."] } });
    }
    const bytes = new Uint8Array(await proof.arrayBuffer());
    const checked = checkUpload(bytes);
    if (!checked) {
      throw new AppError("UPLOAD_INVALID", undefined, { fieldErrors: { proof: ["Upload a PNG, JPG, WebP or PDF under 5 MB."] } });
    }

    const path = `${user!.id}/${orderId}/${crypto.randomUUID()}.${checked.ext}`;
    const upload = await supabase.storage.from("payment-proofs").upload(path, bytes, {
      contentType: checked.mime,
      upsert: false,
    });
    if (upload.error) throw new AppError("INTERNAL", undefined, { cause: upload.error });

    const { error } = await supabase.rpc("submit_payment", {
      p_order_id: orderId,
      p_method_id: methodId,
      p_proof_path: path,
      p_proof_sha256: checked.sha256,
      p_mime: checked.mime,
      p_size: checked.size,
      p_reference: reference,
      p_note: note,
    });
    if (error) {
      // The order didn't accept it (expired, already paid…). Don't leave an orphan file behind
      // when we're able to remove it; customers can't delete storage objects themselves.
      if (serverEnv().SUPABASE_SERVICE_ROLE_KEY) {
        await createAdminClient().storage.from("payment-proofs").remove([path]).catch(() => undefined);
      }
      throw fromDbError(error);
    }

    refresh(orderId);
    return { submitted: true as const };
  },
});

export const cancelOrder = action({
  name: "cancel-order",
  auth: "user",
  rateLimit: { limit: 20, window: "1 h" },
  schema: z.object({ orderId: uuid }),
  async handler({ orderId }, { supabase }) {
    const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId });
    if (error) throw fromDbError(error);
    refresh(orderId);
    return { cancelled: true as const };
  },
});
