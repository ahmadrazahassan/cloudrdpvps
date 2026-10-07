"use client";

import { useSyncExternalStore } from "react";
import { greeting } from "@/lib/format";

const subscribe = () => () => {};
const clientHour = () => new Date().getHours();
const serverHour = () => -1;

/**
 * "Good morning, Aisha" — by the visitor's own clock. The server can't know their time
 * zone, so it renders a neutral "Welcome back" and the browser swaps in the greeting
 * (useSyncExternalStore keeps hydration consistent).
 */
export function Greeting({ name }: { name: string }) {
  const hour = useSyncExternalStore(subscribe, clientHour, serverHour);
  return (
    <>
      {hour < 0 ? "Welcome back" : greeting(hour)}, {name}
    </>
  );
}
