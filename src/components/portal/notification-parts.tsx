"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { markAllNotificationsRead } from "@/app/(portal)/dashboard/notifications/actions";
import { Button } from "@/components/ui/button";
import { getBrowserClient } from "@/lib/supabase/browser";

/**
 * Keeps the bell and the lists current: when a new notification row arrives for this customer
 * (row-level security filters Realtime), the page data is refreshed in place.
 */
export function NotificationsLive({ userId }: { userId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => router.refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, router]);
  return null;
}

export function MarkAllReadButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      loading={pending}
      disabled={disabled}
      onClick={() =>
        start(async () => {
          await markAllNotificationsRead({});
          router.refresh();
        })
      }
    >
      Mark all as read
    </Button>
  );
}
