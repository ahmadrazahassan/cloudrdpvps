"use client";

import { useSyncExternalStore } from "react";
import { formatDate, formatDateTime } from "@/lib/format";

const subscribe = () => () => {};

/**
 * Renders a timestamp. The server HTML is in UTC (identical for everyone, so there is no hydration
 * mismatch); after hydration it switches to the visitor's own time zone and locale. The exact moment
 * is always in the <time datetime> attribute.
 */
export function LocalTime({ value, dateOnly = false }: { value: string; dateOnly?: boolean }) {
  const text = useSyncExternalStore(
    subscribe,
    () => {
      const d = new Date(value);
      return dateOnly
        ? d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
        : d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    },
    () => (dateOnly ? formatDate(value) : `${formatDateTime(value)} UTC`),
  );
  return <time dateTime={value}>{text}</time>;
}
