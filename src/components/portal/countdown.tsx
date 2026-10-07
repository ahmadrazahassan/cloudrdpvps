"use client";

import { useSyncExternalStore } from "react";
import { countdown } from "@/lib/format";

const STEP = 30_000;

/** Ticks every 30 s while mounted. The snapshot is the time rounded to the step, so it is stable between ticks. */
function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, STEP);
  return () => window.clearInterval(id);
}
const clientNow = () => Math.floor(Date.now() / STEP) * STEP;

/**
 * "47h 12m" until a deadline, refreshed every 30 s. The server renders from its own clock (passed in)
 * and the browser takes over after hydration, so the first client render matches the server HTML exactly.
 */
export function Countdown({ to, serverNow }: { to: string; serverNow: number }) {
  const now = useSyncExternalStore(subscribe, clientNow, () => serverNow);
  return <time dateTime={to}>{countdown(to, now)}</time>;
}
