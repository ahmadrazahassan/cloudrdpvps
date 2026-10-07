"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";

const TABLES = ["payments", "orders", "tickets", "ticket_messages", "contact_messages"] as const;

/**
 * Keeps counts and lists current without polling: when a row changes in any queue table, the
 * server-rendered page is refreshed in place (debounced, so a burst of changes is one refresh).
 * Row-level security still decides what staff receive. Renders nothing.
 */
export function LiveSync() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getBrowserClient();
    let timer: number | undefined;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => router.refresh(), 700);
    };
    let channel = supabase.channel("console-queue");
    for (const table of TABLES) channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    channel.subscribe();
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
