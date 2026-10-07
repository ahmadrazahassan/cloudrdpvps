"use client";

import { useSyncExternalStore } from "react";
import { now } from "@/lib/clock";

const subscribe = (notify: () => void) => {
  const id = setInterval(notify, 15_000);
  return () => clearInterval(id);
};
const minute = () => new Date(now()).toISOString().slice(11, 16);

/** A live UTC clock — the time every date in the dashboard and on invoices is shown in. Blank until the page is interactive. */
export function FooterClock() {
  const time = useSyncExternalStore(subscribe, minute, () => "");
  return (
    <span className="num-tabular" suppressHydrationWarning>
      {time ? `${time} UTC` : "UTC"}
    </span>
  );
}
