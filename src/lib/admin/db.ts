import "server-only";
import { cache } from "react";
import { fromDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export { cleanSearch, csvCell, displayName, jsonNumber, jsonString, searchFilter, toCsv } from "./pure";

/**
 * Shared plumbing for the console's read queries. Every query runs as the signed-in staff member
 * (anon key + their session), so row-level security — not this code — decides what comes back.
 * A failed query throws; the nearest error boundary shows it instead of an empty table that looks like "nothing here".
 */
export const db = cache(createClient);

export function ok<T>(r: { data: T | null; error: { code?: string | null; message?: string | null } | null }, fallback: T): T {
  if (r.error) throw fromDbError(r.error);
  return r.data ?? fallback;
}

/** Rows per page in every console list. */
export const ADMIN_PAGE = 25;

export const pageRange = (page: number, per = ADMIN_PAGE): [number, number] => [(page - 1) * per, page * per - 1];
export const pageCount = (total: number, per = ADMIN_PAGE) => Math.max(1, Math.ceil(total / per));

export type ProfileLite = Pick<Tables<"profiles">, "id" | "email" | "full_name" | "status" | "role" | "billing_country">;

const PROFILE_LITE = "id, email, full_name, status, role, billing_country";

/** Look up many customers at once (one query) and index them by id. */
export async function profilesById(ids: (string | null | undefined)[]): Promise<Map<string, ProfileLite>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  const map = new Map<string, ProfileLite>();
  if (unique.length === 0) return map;
  const supabase = await db();
  const rows = ok(await supabase.from("profiles").select(PROFILE_LITE).in("id", unique), [] as ProfileLite[]);
  for (const p of rows) map.set(p.id, p);
  return map;
}
