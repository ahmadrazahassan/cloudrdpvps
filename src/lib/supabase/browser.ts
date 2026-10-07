"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabasePublic } from "@/lib/env";
import type { Database } from "@/types/database";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Browser client — used only for Realtime (notifications, ticket replies). Reads/writes go through server actions. */
export function getBrowserClient() {
  if (!client) {
    const { url, anonKey } = requireSupabasePublic();
    client = createBrowserClient<Database>(url, anonKey);
  }
  return client;
}
